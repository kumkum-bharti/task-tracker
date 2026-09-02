import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// ENDPOINT 1: GET /api/alerts
router.get('/', async (req, res) => {
  try {
    const where = {
      dueDate: { lt: new Date() },
      status: { not: 'DONE' }
    };

    if (req.user.role !== 'MANAGER') {
      where.OR = [
        { project: { members: { some: { userId: req.user.id } } } },
        { assignees: { some: { userId: req.user.id } } }
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: { select: { name: true } },
        alerts: {
          where: { userId: req.user.id }
        }
      }
    });

    const activeAlerts = tasks
      .filter(t => {
        if (t.alerts.length === 0) return true;
        const dismissal = t.alerts[0];
        // If the task's dueDate was modified after it was dismissed, it resurfaces
        return dismissal.dueDateAtDismissal.getTime() !== t.dueDate.getTime();
      })
      .map(t => {
        const daysOverdue = Math.floor((new Date() - t.dueDate) / (1000 * 60 * 60 * 24));
        return {
          taskId: t.id,
          taskTitle: t.title,
          projectId: t.projectId,
          projectName: t.project?.name || '',
          priority: t.priority,
          status: t.status,
          dueDate: t.dueDate,
          daysOverdue
        };
      });

    return res.json(activeAlerts);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ENDPOINT 2: POST /api/alerts/:taskId/dismiss
router.post('/:taskId/dismiss', async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    if (isNaN(taskId)) {
      return res.status(400).json({ error: "Invalid taskId" });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (!task.dueDate || task.dueDate >= new Date() || task.status === 'DONE') {
      return res.status(400).json({ error: "Task is not currently overdue" });
    }

    await prisma.alertDismissal.upsert({
      where: {
        taskId_userId: { taskId, userId: req.user.id }
      },
      update: {
        dueDateAtDismissal: task.dueDate,
        dismissedAt: new Date()
      },
      create: {
        taskId,
        userId: req.user.id,
        dueDateAtDismissal: task.dueDate,
        dismissedAt: new Date()
      }
    });

    return res.status(200).json({ message: "Alert dismissed successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ENDPOINT 3: DELETE /api/alerts/:taskId/dismiss
router.delete('/:taskId/dismiss', async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    if (isNaN(taskId)) {
      return res.status(400).json({ error: "Invalid taskId" });
    }

    await prisma.alertDismissal.deleteMany({
      where: {
        taskId,
        userId: req.user.id
      }
    });

    return res.status(200).json({ message: "Alert reactivated" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
