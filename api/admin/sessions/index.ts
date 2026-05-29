import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../../_lib/auth.js';
import { getDb } from '../../_lib/firebase.js';
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
    // Select only lightweight fields — skip `ciphertext`, `iv`, and `salt` which
    // can each be up to 2 MB and are useless for the listing view.  Encrypted
    // sessions have no `json` field, so its absence doubles as the encrypted flag.
    const snap = await db.collection('sessions')
      .select('clientId', 'updatedAt', 'json', 'writeToken')
      .orderBy('updatedAt', 'desc')
      .limit(500)
      .get();

    const rows: SessionRow[] = snap.docs.map((docSnap: QueryDocumentSnapshot) => {
      const d = docSnap.data();
      // `ciphertext` is not selected, so encrypted sessions simply have no `json` field.
      const encrypted = typeof d.json !== 'string';
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
            ? Object.values(parsed.plans).map((p) => p.name || 'Untitled')
            : undefined;
          base.encounterLevel = parsed.settings?.encounterLevel;
          base.maxHP = parsed.settings?.maxHP;
          base.tankHP = parsed.settings?.tankHP;
        } catch { /* malformed JSON */ }
      }

      return base;
    });

    res.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin] List sessions error:', err);
    res.status(500).json({ error: 'Failed to list sessions', detail: message });
  }
}
