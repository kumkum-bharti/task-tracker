import express from 'express';
import { authenticate, requireManager } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const isArchived = req.query.archived === 'true';
    
    const where = { isArchived };

    if (req.user.role !== 'MANAGER') {
      where.members = {
        some: { userId: req.user.id }
      };
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        owner: {
          select: { id: true, name: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    return res.json(projects);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireManager, async (req, res) => {
  try {
    const { key, name, description, ownerId } = req.body;

    if (!key || !name) {
      return res.status(400).json({ error: 'Key and name are required' });
    }

    const project = await prisma.project.create({
      data: {
        key,
        name,
        description,
        ownerId: ownerId ? parseInt(ownerId) : req.user.id
      }
    });

    return res.status(201).json(project);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Project key already exists' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', requireManager, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const project = await prisma.project.update({
      where: { id: parseInt(req.params.id) },
      data: { name, description }
    });
    
    return res.json(project);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/archive', requireManager, async (req, res) => {
  try {
    const project = await prisma.project.update({
      where: { id: parseInt(req.params.id) },
      data: { isArchived: true }
    });
    
    return res.json(project);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/restore', requireManager, async (req, res) => {
  try {
    const project = await prisma.project.update({
      where: { id: parseInt(req.params.id) },
      data: { isArchived: false }
    });
    
    return res.json(project);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/members', requireManager, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const userId = parseInt(req.body.userId);

    const member = await prisma.projectMember.create({
      data: {
        projectId,
        userId
      }
    });

    return res.status(201).json(member);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'User already a member' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/members/:userId', requireManager, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);

    await prisma.$transaction([
      prisma.taskAssignee.deleteMany({
        where: {
          userId,
          task: {
            projectId
          }
        }
      }),
      prisma.projectMember.delete({
        where: {
          projectId_userId: {
            projectId,
            userId
          }
        }
      })
    ]);

    return res.json({ message: "Member removed and unassigned" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
