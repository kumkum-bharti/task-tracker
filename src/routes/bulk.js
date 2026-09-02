import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireManager } from '../middleware/auth.js';
import { Parser } from 'json2csv';
import { logStatusChange } from '../lib/auditLogger.js';
import { validateTransition, getBlockedFrom } from '../lib/stateMachine.js';

const router = express.Router();
router.use(authenticate);

async function checkProjectAccess(projectId, user) {
  if (user.role === 'MANAGER') return true;
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } }
  });
  return !!member;
}

// ENDPOINT 1: PATCH /tasks/bulk-status
router.patch('/tasks/bulk-status', async (req, res) => {
  try {
    const { taskIds, newStatus } = req.body;
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: "taskIds must be a non-empty array" });
    }
    
    const validStatuses = ['BACKLOG', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE'];
    if (!validStatuses.includes(newStatus)) {
        return res.status(400).json({ error: "Invalid newStatus" });
    }

    const updatedIds = [];
    const failed = [];

    const tasks = await prisma.task.findMany({
      where: { id: { in: taskIds } },
      include: {
        blockedBy: {
          include: { blockingTask: true }
        }
      }
    });

    const tasksToUpdate = [];

    for (const id of taskIds) {
      const task = tasks.find(t => t.id === id);
      if (!task) {
        failed.push({ id, reason: "Task not found" });
        continue;
      }

      // Check permissions
      if (req.user.role !== 'MANAGER') {
        const hasAccess = await checkProjectAccess(task.projectId, req.user);
        if (!hasAccess) {
          failed.push({ id, reason: "Access denied" });
          continue;
        }
      }

      // State machine
      const validation = validateTransition(task.status, newStatus);
      if (!validation.valid) {
        failed.push({ id, reason: validation.reason });
        continue;
      }

      if (newStatus === 'DONE') {
        const unfinishedBlockers = task.blockedBy.filter(
          b => b.blockingTask.status !== 'DONE'
        );
        if (unfinishedBlockers.length > 0) {
          const blockerIds = unfinishedBlockers.map(b => b.blockingTaskId).join(', ');
          failed.push({ id, reason: `Cannot complete task because blocking tasks are not DONE: ${blockerIds}` });
          continue;
        }
      }

      tasksToUpdate.push(task);
    }

    if (tasksToUpdate.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const task of tasksToUpdate) {
          let blockedFrom = task.blockedFrom;
          if (newStatus === 'BLOCKED') {
            blockedFrom = getBlockedFrom(task.status);
          } else if (task.status === 'BLOCKED') {
            blockedFrom = null;
          }

          await tx.task.update({
            where: { id: task.id },
            data: { status: newStatus, blockedFrom }
          });
          
          updatedIds.push(task.id);
        }
      });

      // After transaction, log changes
      for (const task of tasksToUpdate) {
        await logStatusChange(prisma, task.id, req.user.id, task.status, newStatus);
      }
    }

    return res.json({
      updatedCount: updatedIds.length,
      updatedIds,
      failed
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ENDPOINT 2: POST /tasks/bulk-delete
router.post('/tasks/bulk-delete', requireManager, async (req, res) => {
  try {
    const { taskIds } = req.body;
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: "taskIds must be a non-empty array" });
    }

    let deletedCount = 0;

    await prisma.$transaction(async (tx) => {
      // Find actual existing tasks
      const existingTasks = await tx.task.findMany({
        where: { id: { in: taskIds } },
        select: { id: true }
      });
      const validIds = existingTasks.map(t => t.id);
      
      if (validIds.length > 0) {
        deletedCount = validIds.length;
        
        // Delete related records
        await tx.taskAssignee.deleteMany({ where: { taskId: { in: validIds } } });
        await tx.taskBlocker.deleteMany({ 
          where: { 
            OR: [
              { blockedTaskId: { in: validIds } },
              { blockingTaskId: { in: validIds } }
            ]
          } 
        });
        await tx.alertDismissal.deleteMany({ where: { taskId: { in: validIds } } });
        await tx.taskEvent.deleteMany({ where: { taskId: { in: validIds } } });
        await tx.task.deleteMany({ where: { id: { in: validIds } } });
      }
    });

    return res.json({ message: `Successfully deleted ${deletedCount} tasks`, count: deletedCount });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ENDPOINT 3: GET /projects/:projectId/export-csv
router.get('/projects/:projectId/export-csv', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
        return res.status(400).json({ error: "Invalid projectId" });
    }

    const hasAccess = await checkProjectAccess(projectId, req.user);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this project" });
    }

    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: {
        project: { select: { key: true, name: true } },
        createdBy: { select: { name: true } },
        assignees: {
          include: { user: { select: { name: true } } }
        }
      }
    });

    const csvData = tasks.map(t => ({
      id: t.id,
      projectKey: t.project?.key || '',
      title: t.title,
      description: t.description || '',
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate ? t.dueDate.toISOString() : '',
      createdBy: t.createdBy?.name || '',
      assignees: t.assignees.map(a => a.user.name).join(', '),
      createdAt: t.createdAt.toISOString()
    }));

    const fields = ['id', 'projectKey', 'title', 'description', 'status', 'priority', 'dueDate', 'createdBy', 'assignees', 'createdAt'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(csvData);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="project-${projectId}-tasks.csv"`);
    return res.status(200).send(csv);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
