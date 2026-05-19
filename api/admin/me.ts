import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin, verifyAdmin } from '../../_lib/auth';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAdmin(req, res)) return;
  const payload = verifyAdmin(req)!;
  res.json({ username: payload.username, exp: payload.exp });
}
