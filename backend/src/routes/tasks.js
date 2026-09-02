import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireManager } from '../middleware/auth.js';
import { validateTransition, getBlockedFrom } from '../lib/stateMachine.js';
import { 
  logCreated, 
  logFieldChange, 
  logStatusChange, 
  logAssigned, 
  logUnassigned, 
  logComment 
} from '../lib/auditLogger.js';

const router = express.Router();
router.use(authenticate);

async function checkProjectAccess(projectId, user) {
  if (user.role === 'MANAGER') return true;
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } }
  });
  return !!member;
}

async function checkTaskAccess(taskId, user) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return null;
  if (user.role === 'MANAGER') return task;
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: task.projectId, userId: user.id } }
  });
  return member ? task : null;
}

// ENDPOINT 1: POST /project/:projectId
router.post('/project/:projectId', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const hasAccess = await checkProjectAccess(projectId, req.user);
    
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this project" });
    }

    const { title, description, priority = 'MEDIUM', dueDate, blockerIds = [] } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    // Create the task
    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'BACKLOG',
        projectId,
        createdById: req.user.id
      }
    });

    // Create blockers if any
    if (blockerIds.length > 0) {
      const blockersData = blockerIds.map(blockingId => ({
        blockedTaskId: task.id,
        blockingTaskId: parseInt(blockingId)
      }));
      await prisma.taskBlocker.createMany({ data: blockersData });
    }

    await logCreated(prisma, task.id, req.user.id);

    return res.status(201).json(task);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ENDPOINT 2: GET /project/:projectId
router.get('/project/:projectId', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const hasAccess = await checkProjectAccess(projectId, req.user);
    
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this project" });
    }

    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: {
        assignees: {
          include: { user: { select: { id: true, name: true, email: true } } }
        },
        blockedBy: true
      }
    });

    return res.json(tasks);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ENDPOINT 3: PATCH /:id
router.patch('/:id', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const task = await checkTaskAccess(taskId, req.user);
    if (!task) return res.status(403).json({ error: "Access denied or task not found" });

    const { title, description, priority, dueDate } = req.body;
    
    // Check and log field changes
    if (title && title !== task.title) {
      await logFieldChange(prisma, taskId, req.user.id, 'title', task.title, title);
    }
    if (description !== undefined && description !== task.description) {
      await logFieldChange(prisma, taskId, req.user.id, 'description', task.description, description);
    }
    if (priority && priority !== task.priority) {
      await logFieldChange(prisma, taskId, req.user.id, 'priority', task.priority, priority);
    }
    
    let parsedDueDate = task.dueDate;
    if (dueDate !== undefined) {
      parsedDueDate = dueDate ? new Date(dueDate) : null;
      const oldDueStr = task.dueDate ? task.dueDate.toISOString() : null;
      const newDueStr = parsedDueDate ? parsedDueDate.toISOString() : null;
      
      if (oldDueStr !== newDueStr) {
        await logFieldChange(prisma, taskId, req.user.id, 'dueDate', oldDueStr, newDueStr);
        // Clear alert dismissals if due date changed
        await prisma.alertDismissal.deleteMany({
          where: { taskId }
        });
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(priority && { priority }),
        ...(dueDate !== undefined && { dueDate: parsedDueDate })
      }
    });

    return res.json(updatedTask);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ENDPOINT 4: DELETE /:id
router.delete('/:id', requireManager, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    await prisma.task.delete({ where: { id: taskId } });
    return res.json({ message: "Task deleted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ENDPOINT 5: PATCH /:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        blockedBy: {
          include: { blockingTask: true }
        }
      }
    });

    if (!task) return res.status(404).json({ error: "Task not found" });

    // Check project access
    if (req.user.role !== 'MANAGER') {
      const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: task.projectId, userId: req.user.id } }
      });
      if (!member) return res.status(403).json({ error: "Access denied" });
    }

    const { newStatus } = req.body;
    if (!newStatus) return res.status(400).json({ error: "newStatus is required" });

    const validation = validateTransition(task.status, newStatus);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.reason });
    }

    if (newStatus === 'DONE') {
      const unfinishedBlockers = task.blockedBy.filter(
        b => b.blockingTask.status !== 'DONE'
      );
      if (unfinishedBlockers.length > 0) {
        const blockerIds = unfinishedBlockers.map(b => b.blockingTaskId).join(', ');
        return res.status(400).json({ 
          error: `Cannot complete task because blocking tasks are not DONE: ${blockerIds}` 
        });
      }
    }

    let blockedFrom = task.blockedFrom;
    if (newStatus === 'BLOCKED') {
      blockedFrom = getBlockedFrom(task.status);
    } else if (task.status === 'BLOCKED') {
      blockedFrom = null;
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { 
        status: newStatus,
        blockedFrom 
      }
    });

    await logStatusChange(prisma, taskId, req.user.id, task.status, newStatus);

    return res.json(updatedTask);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ENDPOINT 6: POST /:id/assignees
router.post('/:id/assignees', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const userId = parseInt(req.body.userId);
    
    const task = await checkTaskAccess(taskId, req.user);
    if (!task) return res.status(403).json({ error: "Access denied or task not found" });

    const isMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: task.projectId, userId } }
    });

    if (!isMember) {
      return res.status(400).json({ error: "User is not a member of this project" });
    }

    await prisma.taskAssignee.create({
      data: { taskId, userId }
    });

    await logAssigned(prisma, taskId, req.user.id, userId);

    return res.status(201).json({ message: "Assigned successfully" });
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: "Already assigned" });
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ENDPOINT 7: DELETE /:id/assignees/:userId
router.delete('/:id/assignees/:userId', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);

    const task = await checkTaskAccess(taskId, req.user);
    if (!task) return res.status(403).json({ error: "Access denied or task not found" });

    await prisma.taskAssignee.delete({
      where: { taskId_userId: { taskId, userId } }
    });

    await logUnassigned(prisma, taskId, req.user.id, userId);

    return res.json({ message: "Assignee removed" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ENDPOINT 8: POST /:id/comments
router.post('/:id/comments', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const { text } = req.body;
    
    if (!text) return res.status(400).json({ error: "Comment text is required" });

    const task = await checkTaskAccess(taskId, req.user);
    if (!task) return res.status(403).json({ error: "Access denied or task not found" });

    const event = await logComment(prisma, taskId, req.user.id, text);

    return res.status(201).json(event);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ENDPOINT 9: GET /:id/timeline
router.get('/:id/timeline', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const task = await checkTaskAccess(taskId, req.user);
    if (!task) return res.status(403).json({ error: "Access denied or task not found" });

    const events = await prisma.taskEvent.findMany({
      where: { taskId },
      include: {
        actor: { select: { name: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    return res.json(events);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ENDPOINT 10: GET / (Task search)
router.get('/', async (req, res) => {
  try {
    const { 
      search, projectId, status, assigneeId, priority, overdue, 
      sortBy = 'updatedAt', sortOrder = 'desc', 
      page = '1', limit = '20' 
    } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (pageNum - 1) * limitNum;

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
    if (assigneeId) {
      where.assignees = { some: { userId: parseInt(assigneeId) } };
    }
    if (overdue === 'true') {
      where.dueDate = { lt: new Date() };
      if (!where.status) {
        where.status = { not: 'DONE' };
      } else if (where.status === 'DONE') {
        // Logically impossible to be overdue and DONE in our rule, but respect the filter
        where.status = 'DONE';
      }
    }

    const validSortFields = ['dueDate', 'priority', 'updatedAt'];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'updatedAt';
    const orderByDirection = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: { [orderByField]: orderByDirection },
        skip,
        take: limitNum,
        include: {
          project: { select: { name: true } },
          assignees: { include: { user: { select: { name: true } } } }
        }
      }),
      prisma.task.count({ where })
    ]);

    return res.json({
      tasks,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ENDPOINT 11: GET /my-tasks
router.get('/my-tasks', async (req, res) => {
  try {
    const assignments = await prisma.taskAssignee.findMany({
      where: { userId: req.user.id },
      include: {
        task: {
          include: {
            project: { select: { name: true } }
          }
        }
      }
    });

    const tasks = assignments.map(a => a.task);
    return res.json(tasks);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
