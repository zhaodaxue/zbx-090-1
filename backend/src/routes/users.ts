import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { authMiddleware, residentMiddleware, adminMiddleware } from '../middleware/auth';
import { computeStats } from './topics';
import { validate, createUserSchema } from '../middleware/validate';
import bcrypt from 'bcryptjs';

const router = Router();

router.get('/my/records', authMiddleware, residentMiddleware, async (req: Request, res: Response): Promise<void> => {
  const votes = await prisma.vote.findMany({
    where: { userId: req.user!.userId },
    include: {
      topic: {
        select: {
          id: true,
          title: true,
          stage: true,
          voteResult: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const allTopics = await prisma.topic.findMany({
    where: { stage: 'ARCHIVED' },
    select: { id: true, title: true, stage: true, voteResult: true, createdAt: true },
  });
  const votedTopicIds = new Set(votes.map((v) => v.topicId));
  const missed = allTopics.filter((t) => !votedTopicIds.has(t.id));

  res.json({ votes, missed });
});

router.get('/', authMiddleware, adminMiddleware, async (_req: Request, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    where: { role: 'RESIDENT' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      username: true,
      realName: true,
      roomNumber: true,
      status: true,
      consecutiveMiss: true,
      createdAt: true,
    },
  });
  res.json(users);
});

router.post('/', authMiddleware, adminMiddleware, validate(createUserSchema), async (req: Request, res: Response): Promise<void> => {
  const { username, password, realName, roomNumber } = req.body;
  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) {
    res.status(400).json({ error: '用户名已存在' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, passwordHash, realName, roomNumber },
    select: { id: true, username: true, realName: true, roomNumber: true, status: true, createdAt: true },
  });
  res.status(201).json(user);
});

router.post('/:id/lift-observation', authMiddleware, adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  if (user.role !== 'RESIDENT') {
    res.status(400).json({ error: '仅住户账号可解除观察状态' });
    return;
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { status: 'NORMAL', consecutiveMiss: 0 },
    select: { id: true, username: true, realName: true, status: true, consecutiveMiss: true },
  });
  res.json(updated);
});

export default router;
