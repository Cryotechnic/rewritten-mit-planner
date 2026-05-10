/**
 * planSync.ts — Firestore sync for mit planner plans.
 *
 * Each shared session is stored at: sessions/{shareId}
 * {
 *   json: string,       // full PlanData serialized via JSON (Sets → {__type:'Set',...})
 *   clientId: string,   // last writer — used to suppress echo on sender
 *   updatedAt: number,  // Date.now() of last write
 * }
 *
 * shareId is a 6-char alphanumeric code easy to share verbally (e.g. "X4K9MQ").
 */

import {
  doc,
  setDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

const COLLECTION = 'sessions';

// Reuse the same replacer/reviver as the Zustand store for Set serialization
function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Set) return { __type: 'Set', values: [...value] };
  return value;
}

function reviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && (value as any).__type === 'Set') {
    return new Set((value as any).values);
  }
  return value;
}

export function generateShareId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/1/0 to avoid confusion
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function pushPlan(
  shareId: string,
  plans: object,
  activePlanId: string,
  clientId: string,
): Promise<void> {
  const json = JSON.stringify({ plans, activePlanId }, replacer);
  await setDoc(doc(db, COLLECTION, shareId), {
    json,
    clientId,
    updatedAt: Date.now(),
  });
}

export function subscribePlan(
  shareId: string,
  clientId: string,
  onUpdate: (plans: unknown, activePlanId: string) => void,
): Unsubscribe {
  return onSnapshot(doc(db, COLLECTION, shareId), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.clientId === clientId) return;
    try {
      const parsed = JSON.parse(data.json, reviver);
      onUpdate(parsed.plans, parsed.activePlanId);
    } catch {
      // Malformed doc — ignore
    }
  });
}
