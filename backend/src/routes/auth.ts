import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { signToken } from '../utils/jwt';
import { validate, loginSchema } from '../middleware/validate';

const router = Router();

router.post('/login', validate(loginSchema), async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }
  const token = signToken({ userId: user.id, username: user.username, role: user.role });
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      realName: user.realName,
      roomNumber: user.roomNumber,
      role: user.role,
      status: user.status,
    },
  });
});

router.get('/me', async (req: Request, res: Response): Promise<void> => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  try {
    const { verifyToken } = await import('../utils/jwt');
    const payload = verifyToken(header.slice(7));
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      res.status(401).json({ error: '用户不存在' });
      return;
    }
    res.json({
      id: user.id,
      username: user.username,
      realName: user.realName,
      roomNumber: user.roomNumber,
      role: user.role,
      status: user.status,
      consecutiveMiss: user.consecutiveMiss,
    });
  } catch (e) {
    res.status(401).json({ error: '令牌无效' });
  }
});

export default router;
