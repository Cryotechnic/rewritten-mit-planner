/**
 * Stateless HMAC-signed OAuth state: avoids in-memory Map issues across
 * serverless function invocations. State = `timestamp.hmac_signature`.
 */
import { createHmac, timingSafeEqual } from 'crypto';

const TTL_MS = 600_000; // 10 minutes

export function createOAuthState(): string {
  const ts = Date.now().toString(36);
  return `${ts}.${sign(ts)}`;
}

export function verifyOAuthState(state: string): boolean {
  const dot = state.lastIndexOf('.');
  if (dot === -1) return false;
  const ts = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = sign(ts);
  try {
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return false;
    if (!timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  return Date.now() - parseInt(ts, 36) < TTL_MS;
}

function sign(data: string): string {
  return createHmac('sha256', process.env.ADMIN_JWT_SECRET!)
    .update(data)
    .digest('hex');
}
