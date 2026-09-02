import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireManager } from '../middleware/auth.js';

const router = express.Router();

async function checkProjectAccess(projectId, user) {
  if (user.role === 'MANAGER') return true;
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } }
  });
  return !!member;
}

// ENDPOINT 1: GET /api/dashboard/summary
router.get('/summary', authenticate, requireManager, async (req, res) => {
  try {
    const now = new Date();
    
    // Start of current week (Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - now.getDay());

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    // Headline numbers
    const openTasks = await prisma.task.count({
      where: { 
        status: { not: 'DONE' },
        project: { isArchived: false }
      }
    });

    const overdueCount = await prisma.task.count({
      where: { 
        dueDate: { lt: now }, 
        status: { not: 'DONE' },
        project: { isArchived: false }
      }
    });

    const dueThisWeek = await prisma.task.count({
      where: { 
        dueDate: { gte: startOfWeek, lte: endOfWeek },
        status: { not: 'DONE' },
        project: { isArchived: false }
      }
    });

    const completedThisWeek = await prisma.task.count({
      where: {
        status: 'DONE',
        updatedAt: { gte: startOfWeek },
        project: { isArchived: false }
      }
    });

    // Distributions
    const statusGroup = await prisma.task.groupBy({
      by: ['status'],
      _count: { id: true },
      where: { project: { isArchived: false } }
    });

    const priorityGroup = await prisma.task.groupBy({
      by: ['priority'],
      _count: { id: true },
      where: { project: { isArchived: false } }
    });

    const statusDistribution = {};
    for (const g of statusGroup) {
      statusDistribution[g.status] = g._count.id;
    }

    const priorityDistribution = {};
    for (const g of priorityGroup) {
      priorityDistribution[g.priority] = g._count.id;
    }

    // Chart completions over last 8 weeks
    const eightWeeksAgo = new Date(startOfWeek);
    eightWeeksAgo.setDate(startOfWeek.getDate() - 7 * 7);

    const completedEvents = await prisma.taskEvent.findMany({
      where: {
        eventType: 'STATUS_CHANGED',
        newValue: 'DONE',
        createdAt: { gte: eightWeeksAgo }
      },
      select: { createdAt: true }
    });

    const completionsLastEightWeeks = [];
    for (let i = 7; i >= 0; i--) {
      const wStart = new Date(startOfWeek);
      wStart.setDate(startOfWeek.getDate() - i * 7);
      const wEnd = new Date(wStart);
      wEnd.setDate(wStart.getDate() + 7);

      const count = completedEvents.filter(e => {
        const d = new Date(e.createdAt);
        return d >= wStart && d < wEnd;
      }).length;

      const label = `W${8 - i}`;
      completionsLastEightWeeks.push({ week: label, completions: count });
    }

    return res.json({
      openTasks,
      overdueCount,
      dueThisWeek,
      completedThisWeek,
      statusDistribution,
      priorityDistribution,
      completionsLastEightWeeks
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ENDPOINT 2: GET /api/dashboard/team-workload
router.get('/team-workload', authenticate, requireManager, async (req, res) => {
  try {
    const members = await prisma.user.findMany({
      where: { role: 'MEMBER' },
      select: { id: true, name: true, email: true }
    });

    const activeCounts = await prisma.taskAssignee.groupBy({
      by: ['userId'],
      where: { task: { status: { not: 'DONE' } } },
      _count: { taskId: true }
    });

    const inProgressCounts = await prisma.taskAssignee.groupBy({
      by: ['userId'],
      where: { task: { status: 'IN_PROGRESS' } },
      _count: { taskId: true }
    });

    const blockedCounts = await prisma.taskAssignee.groupBy({
      by: ['userId'],
      where: { task: { status: 'BLOCKED' } },
      _count: { taskId: true }
    });

    const overdueCounts = await prisma.taskAssignee.groupBy({
      by: ['userId'],
      where: { task: { dueDate: { lt: new Date() }, status: { not: 'DONE' } } },
      _count: { taskId: true }
    });

    let workload = members.map(user => {
      const active = activeCounts.find(c => c.userId === user.id)?._count.taskId || 0;
      const inProgress = inProgressCounts.find(c => c.userId === user.id)?._count.taskId || 0;
      const blocked = blockedCounts.find(c => c.userId === user.id)?._count.taskId || 0;
      const overdue = overdueCounts.find(c => c.userId === user.id)?._count.taskId || 0;

      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        activeTasks: active,
        inProgress,
        blocked,
        overdue
      };
    });

    workload.sort((a, b) => b.activeTasks - a.activeTasks);

    return res.json(workload);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
