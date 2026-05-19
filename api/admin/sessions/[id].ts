import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../../../_lib/auth';
import { getDb } from '../../../_lib/firebase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!requireAdmin(req, res)) return;

  const { id } = req.query as { id: string };

  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(id)) {
    res.status(400).json({ error: 'Invalid session ID format' });
    return;
  }

  try {
    const db = getDb();
    await db.collection('sessions').doc(id).delete();
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin] Delete session error:', err);
    res.status(500).json({ error: 'Failed to delete session' });
  }
}
