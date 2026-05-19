import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../../_lib/auth';
import { getDb } from '../../_lib/firebase';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';

interface SessionRow {
  id: string;
  encrypted: boolean;
  clientId: string;
  updatedAt: number;
  planCount?: number;
  planNames?: string[];
  encounterLevel?: number;
  maxHP?: number;
  tankHP?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!requireAdmin(req, res)) return;

  try {
    const db = getDb();
    const snap = await db.collection('sessions').get();

    const rows: SessionRow[] = snap.docs.map((docSnap: QueryDocumentSnapshot) => {
      const d = docSnap.data();
      const encrypted = 'ciphertext' in d;
      const base: SessionRow = {
        id: docSnap.id,
        encrypted,
        clientId: d.clientId as string,
        updatedAt: d.updatedAt as number,
      };

      if (!encrypted && typeof d.json === 'string') {
        try {
          const parsed = JSON.parse(d.json) as {
            plans?: Record<string, { name?: string }>;
            settings?: { maxHP?: number; tankHP?: number; encounterLevel?: number };
          };
          base.planCount = parsed.plans ? Object.keys(parsed.plans).length : undefined;
          base.planNames = parsed.plans
            ? Object.values(parsed.plans).map((p) => p.name ?? 'Untitled')
            : undefined;
          base.encounterLevel = parsed.settings?.encounterLevel;
          base.maxHP = parsed.settings?.maxHP;
          base.tankHP = parsed.settings?.tankHP;
        } catch { /* malformed JSON */ }
      }

      return base;
    });

    rows.sort((a, b) => b.updatedAt - a.updatedAt);
    res.json(rows);
  } catch (err) {
    console.error('[admin] List sessions error:', err);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
}
