import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: '未提供认证令牌' });
    return;
  }
  try {
    const token = header.slice(7);
    req.user = verifyToken(token);
    next();
  } catch (err) {
    res.status(401).json({ error: '认证令牌无效或已过期' });
  }
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ error: '需要管理员权限' });
    return;
  }
  next();
}

export function residentMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  if (req.user.role !== 'RESIDENT') {
    res.status(403).json({ error: '仅住户可执行此操作' });
    return;
  }
  next();
}
