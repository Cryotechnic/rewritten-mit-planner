import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface AdminPayload { admin: boolean; username: string; exp: number; }

export function verifyAdmin(req: VercelRequest): AdminPayload | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(auth.slice(7), process.env.ADMIN_JWT_SECRET!) as AdminPayload;
    if (!payload.admin) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAdmin(req: VercelRequest, res: VercelResponse): boolean {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}
