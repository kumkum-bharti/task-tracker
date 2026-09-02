import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireManager } from '../middleware/auth.js';
import { Parser } from 'json2csv';
import { logStatusChange, logAssigned, logFieldChange } from '../lib/auditLogger.js';
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

// ENDPOINT 1: PATCH /tasks/bulk-update (Unified Bulk Status, Assignee, Due Date updates with per-task reporting)
router.patch('/tasks/bulk-update', async (req, res) => {
  try {
    const { taskIds, actionType, value } = req.body;
    
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: "taskIds must be a non-empty array" });
    }

    if (!['status', 'assignee', 'dueDate'].includes(actionType)) {
      return res.status(400).json({ error: "actionType must be one of: status, assignee, dueDate" });
    }

    const updatedIds = [];
    const failed = [];

    const tasks = await prisma.task.findMany({
      where: { id: { in: taskIds } },
      include: {
        project: { select: { name: true, key: true } },
        blockedBy: { include: { blockingTask: true } }
      }
    });

    for (const id of taskIds) {
      const task = tasks.find(t => t.id === id);
      if (!task) {
        failed.push({ id, title: `Task #${id}`, reason: "Task not found" });
        continue;
      }

      // Check permissions
      if (req.user.role !== 'MANAGER') {
        const hasAccess = await checkProjectAccess(task.projectId, req.user);
        if (!hasAccess) {
          failed.push({ id: task.id, title: task.title, reason: "Access denied to project" });
          continue;
        }
      }

      try {
        if (actionType === 'status') {
          const newStatus = value;
          const validStatuses = ['BACKLOG', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE'];
          if (!validStatuses.includes(newStatus)) {
            failed.push({ id: task.id, title: task.title, reason: `Invalid status: ${newStatus}` });
            continue;
          }

          const validation = validateTransition(task.status, newStatus, task.blockedFrom);
          if (!validation.valid) {
            failed.push({ id: task.id, title: task.title, reason: validation.reason });
            continue;
          }

          if (newStatus === 'DONE') {
            const unfinishedBlockers = task.blockedBy.filter(b => b.blockingTask.status !== 'DONE');
            if (unfinishedBlockers.length > 0) {
              const blockerIds = unfinishedBlockers.map(b => b.blockingTaskId).join(', ');
              failed.push({ id: task.id, title: task.title, reason: `Cannot complete task because blocking tasks are not DONE: #${blockerIds}` });
              continue;
            }
          }

          let blockedFrom = task.blockedFrom;
          if (newStatus === 'BLOCKED') {
            blockedFrom = getBlockedFrom(task.status);
          } else if (task.status === 'BLOCKED') {
            blockedFrom = null;
          }

          await prisma.task.update({
            where: { id: task.id },
            data: { status: newStatus, blockedFrom }
          });

          await logStatusChange(prisma, task.id, req.user.id, task.status, newStatus);
          updatedIds.push(task.id);
        } 
        else if (actionType === 'assignee') {
          const userId = parseInt(value);
          if (isNaN(userId)) {
            failed.push({ id: task.id, title: task.title, reason: "Invalid assignee user ID" });
            continue;
          }

          // Verify target user belongs to the project
          const isMember = await prisma.projectMember.findUnique({
            where: { projectId_userId: { projectId: task.projectId, userId } }
          });

          if (!isMember) {
            failed.push({ id: task.id, title: task.title, reason: `Target user is not a member of project ${task.project?.name || ''}` });
            continue;
          }

          // Assign if not assigned
          const existing = await prisma.taskAssignee.findUnique({
            where: { taskId_userId: { taskId: task.id, userId } }
          });

          if (!existing) {
            await prisma.taskAssignee.create({
              data: { taskId: task.id, userId }
            });
            await logAssigned(prisma, task.id, req.user.id, userId);
          }
          updatedIds.push(task.id);
        }
        else if (actionType === 'dueDate') {
          const parsedDueDate = value ? new Date(value) : null;
          const oldDueStr = task.dueDate ? task.dueDate.toISOString() : null;
          const newDueStr = parsedDueDate ? parsedDueDate.toISOString() : null;

          await prisma.task.update({
            where: { id: task.id },
            data: { dueDate: parsedDueDate }
          });

          if (oldDueStr !== newDueStr) {
            await logFieldChange(prisma, task.id, req.user.id, 'dueDate', oldDueStr, newDueStr);
            await prisma.alertDismissal.deleteMany({ where: { taskId: task.id } });
          }
          updatedIds.push(task.id);
        }
      } catch (err) {
        failed.push({ id: task.id, title: task.title, reason: err.message || "Failed to update" });
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

// ENDPOINT 2: PATCH /tasks/bulk-status (Legacy endpoint for backwards compatibility)
router.patch('/tasks/bulk-status', async (req, res) => {
  req.body.actionType = 'status';
  req.body.value = req.body.newStatus;
  return router.handle(req, res);
});

// ENDPOINT 3: POST /tasks/bulk-delete
router.post('/tasks/bulk-delete', requireManager, async (req, res) => {
  try {
    const { taskIds } = req.body;
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: "taskIds must be a non-empty array" });
    }

    let deletedCount = 0;

    await prisma.$transaction(async (tx) => {
      const existingTasks = await tx.task.findMany({
        where: { id: { in: taskIds } },
        select: { id: true }
      });
      const validIds = existingTasks.map(t => t.id);
      
      if (validIds.length > 0) {
        deletedCount = validIds.length;
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

// ENDPOINT 4: GET /tasks/export-csv (Filtered Task Search CSV Export)
router.get('/tasks/export-csv', async (req, res) => {
  try {
    const { search, projectId, status, assigneeId, priority, overdue } = req.query;

    const where = {};

    if (req.user.role !== 'MANAGER') {
      where.project = {
        members: { some: { userId: req.user.id } }
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (projectId) where.projectId = parseInt(projectId);
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assigneeId) where.assignees = { some: { userId: parseInt(assigneeId) } };
    if (overdue === 'true') {
      where.dueDate = { lt: new Date() };
      where.status = { not: 'DONE' };
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        project: { select: { key: true, name: true } },
        createdBy: { select: { name: true } },
        assignees: { include: { user: { select: { name: true } } } }
      }
    });

    const csvData = tasks.map(t => ({
      id: t.id,
      projectKey: t.project?.key || '',
      projectName: t.project?.name || '',
      title: t.title,
      description: t.description || '',
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate ? t.dueDate.toISOString() : '',
      createdBy: t.createdBy?.name || '',
      assignees: t.assignees.map(a => a.user?.name || '').filter(Boolean).join(', '),
      createdAt: t.createdAt.toISOString()
    }));

    const fields = ['id', 'projectKey', 'projectName', 'title', 'description', 'status', 'priority', 'dueDate', 'createdBy', 'assignees', 'createdAt'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(csvData);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="filtered-tasks.csv"');
    return res.status(200).send(csv);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ENDPOINT 5: GET /projects/:projectId/export-csv (Project specific CSV export)
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
        assignees: { include: { user: { select: { name: true } } } }
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
      assignees: t.assignees.map(a => a.user?.name || '').filter(Boolean).join(', '),
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
