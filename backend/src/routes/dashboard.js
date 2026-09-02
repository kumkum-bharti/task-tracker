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
    const totalProjects = await prisma.project.count({
      where: { isArchived: false }
    });

    const totalTasks = await prisma.task.count({
      where: { project: { isArchived: false } }
    });

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

    const overdueCount = await prisma.task.count({
      where: { 
        dueDate: { lt: new Date() }, 
        status: { not: 'DONE' },
        project: { isArchived: false }
      }
    });

    const blockerBottlenecks = await prisma.task.count({
      where: { 
        status: 'BLOCKED',
        project: { isArchived: false }
      }
    });

    const statusDistribution = {};
    for (const g of statusGroup) {
      statusDistribution[g.status] = g._count.id;
    }

    const priorityDistribution = {};
    for (const g of priorityGroup) {
      priorityDistribution[g.priority] = g._count.id;
    }

    return res.json({
      totalProjects,
      totalTasks,
      overdueCount,
      statusDistribution,
      priorityDistribution
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

    // Merge the database aggregations
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

    // Order users by active task count descending
    workload.sort((a, b) => b.activeTasks - a.activeTasks);

    return res.json(workload);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ENDPOINT 3: GET /api/dashboard/project-progress/:projectId
router.get('/project-progress/:projectId', authenticate, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: "Invalid projectId" });
    }

    const hasAccess = await checkProjectAccess(projectId, req.user);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this project" });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const totalTasks = await prisma.task.count({
      where: { projectId }
    });

    const completedTasks = await prisma.task.count({
      where: { projectId, status: 'DONE' }
    });

    const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const statusGroup = await prisma.task.groupBy({
      by: ['status'],
      _count: { id: true },
      where: { projectId }
    });

    const statusBreakdown = {};
    for (const g of statusGroup) {
      statusBreakdown[g.status] = g._count.id;
    }

    return res.json({
      projectId: project.id,
      projectName: project.name,
      totalTasks,
      completedTasks,
      progressPercentage,
      statusBreakdown
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
