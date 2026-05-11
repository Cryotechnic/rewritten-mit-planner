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
  getDoc,
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
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

/** 24-char URL-safe write token embedded in the edit link hash. */
export function generateWriteToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

// ── Encryption helpers ──────────────────────────────────────────────────────

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer)));
}

function fromBase64(s: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptJson(json: string, password: string): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>;
  const iv = crypto.getRandomValues(new Uint8Array(12)) as Uint8Array<ArrayBuffer>;
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(json));
  return { ciphertext: toBase64(encrypted), iv: toBase64(iv), salt: toBase64(salt) };
}

async function decryptJson(ciphertext: string, iv: string, salt: string, password: string): Promise<string> {
  const key = await deriveKey(password, fromBase64(salt));
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) }, key, fromBase64(ciphertext),
  );
  return new TextDecoder().decode(decrypted);
}

// ── Session metadata ────────────────────────────────────────────────────────

/** Check whether a session exists and whether it is encrypted. */
export async function getSessionMeta(shareId: string): Promise<{ exists: boolean; encrypted: boolean }> {
  const snap = await getDoc(doc(db, COLLECTION, shareId));
  if (!snap.exists()) return { exists: false, encrypted: false };
  return { exists: true, encrypted: typeof snap.data().ciphertext === 'string' };
}

/** Validate a password against the current session document (one-time read). */
export async function validateSessionPassword(shareId: string, password: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, shareId));
    if (!snap.exists()) return false;
    const data = snap.data();
    if (typeof data.ciphertext !== 'string') return true; // not encrypted
    await decryptJson(data.ciphertext, data.iv, data.salt, password);
    return true;
  } catch {
    return false;
  }
}

export interface GlobalSettings {
  maxHP: number;
  tankHP: number;
  encounterLevel: number;
}

export async function pushPlan(
  shareId: string,
  plans: object,
  activePlanId: string,
  clientId: string,
  settings: GlobalSettings,
  password?: string,
  writeToken?: string,
): Promise<void> {
  const json = JSON.stringify({ plans, activePlanId, settings }, replacer);
  const base = { clientId, updatedAt: Date.now(), ...(writeToken ? { writeToken } : {}) };
  if (password) {
    const { ciphertext, iv, salt } = await encryptJson(json, password);
    await setDoc(doc(db, COLLECTION, shareId), { ciphertext, iv, salt, ...base });
  } else {
    await setDoc(doc(db, COLLECTION, shareId), { json, ...base });
  }
}

export function subscribePlan(
  shareId: string,
  clientId: string,
  onUpdate: (plans: unknown, activePlanId: string, settings: GlobalSettings | undefined) => void,
  password?: string,
  onNeedsPassword?: () => void,
  onWaiting?: () => void,
): Unsubscribe {
  return onSnapshot(doc(db, COLLECTION, shareId), async (snap) => {
    if (!snap.exists()) {
      onWaiting?.();
      return;
    }
    const data = snap.data();
    if (data.clientId === clientId) return;

    let json: string;
    if (typeof data.ciphertext === 'string') {
      if (!password) {
        onNeedsPassword?.();
        return;
      }
      try {
        json = await decryptJson(data.ciphertext, data.iv, data.salt, password);
      } catch {
        return; // wrong password or corrupt — ignore
      }
    } else {
      if (typeof data.json !== 'string' || data.json.length > 2097152) return;
      json = data.json;
    }

    try {
      const parsed = JSON.parse(json, reviver);
      if (
        parsed === null ||
        typeof parsed !== 'object' ||
        typeof parsed.activePlanId !== 'string' ||
        typeof parsed.plans !== 'object' ||
        parsed.plans === null
      ) return;
      onUpdate(parsed.plans, parsed.activePlanId, parsed.settings);
    } catch {
      // Malformed — ignore
    }
  });
}
