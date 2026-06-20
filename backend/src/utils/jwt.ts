import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'yishiting-dev-secret';

export interface JwtPayload {
  userId: string;
  username: string;
  role: 'ADMIN' | 'RESIDENT';
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
