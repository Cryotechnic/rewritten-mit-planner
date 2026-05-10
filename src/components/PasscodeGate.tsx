import React, { useState } from 'react';

const CODE_HASH = import.meta.env.VITE_ACCESS_CODE_HASH as string | undefined;
const SESSION_KEY = 'mit-planner-auth';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes
const LOCKOUT_KEY = 'mit-planner-lockout';

async function sha256(message: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getLockout(): { attempts: number; lockedUntil: number } {
  try {
    return JSON.parse(sessionStorage.getItem(LOCKOUT_KEY) ?? '{"attempts":0,"lockedUntil":0}');
  } catch {
    return { attempts: 0, lockedUntil: 0 };
  }
}

function saveLockout(data: { attempts: number; lockedUntil: number }) {
  sessionStorage.setItem(LOCKOUT_KEY, JSON.stringify(data));
}

interface Props {
  children: React.ReactNode;
}

export default function PasscodeGate({ children }: Props) {
  // If no hash is configured, don't gate at all
  if (!CODE_HASH) return <>{children}</>;

  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === CODE_HASH);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lockout, setLockout] = useState(getLockout);

  // Already authed in this session
  if (authed) return <>{children}</>;

  const now = Date.now();
  const isLocked = lockout.lockedUntil > now;
  const secondsLeft = isLocked ? Math.ceil((lockout.lockedUntil - now) / 1000) : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLocked || checking || !input.trim()) return;

    setChecking(true);
    setError(false);

    // Artificial minimum delay to slow brute force
    const [hash] = await Promise.all([
      sha256(input.trim()),
      new Promise((r) => setTimeout(r, 600)),
    ]);

    if (hash === CODE_HASH) {
      sessionStorage.setItem(SESSION_KEY, CODE_HASH);
      sessionStorage.removeItem(LOCKOUT_KEY);
      setAuthed(true);
    } else {
      const prev = getLockout();
      const attempts = prev.attempts + 1;
      const lockedUntil = attempts >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0;
      const next = { attempts, lockedUntil };
      saveLockout(next);
      setLockout(next);
      setError(true);
      setInput('');
    }
    setChecking(false);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <form onSubmit={handleSubmit} style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '36px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        minWidth: '300px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text)', textAlign: 'center' }}>
          Access restricted
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
          Enter the team passphrase to continue.
        </div>
        {isLocked ? (
          <div style={{ fontSize: '13px', color: 'var(--danger)', textAlign: 'center' }}>
            Too many incorrect attempts.<br />Try again in {secondsLeft}s.
          </div>
        ) : (
          <>
            <input
              type="password"
              autoFocus
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(false); }}
              placeholder="Passphrase"
              disabled={checking}
              style={{
                background: 'var(--surface2)',
                border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
                borderRadius: '6px',
                color: 'var(--text)',
                fontSize: '14px',
                padding: '8px 12px',
                outline: 'none',
              }}
            />
            {error && (
              <div style={{ fontSize: '12px', color: 'var(--danger)', textAlign: 'center', marginTop: '-8px' }}>
                Incorrect passphrase.{lockout.attempts >= 2 ? ` ${MAX_ATTEMPTS - lockout.attempts} attempt${MAX_ATTEMPTS - lockout.attempts !== 1 ? 's' : ''} remaining.` : ''}
              </div>
            )}
            <button
              type="submit"
              disabled={checking || !input.trim()}
              style={{
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: checking || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: checking || !input.trim() ? 0.6 : 1,
              }}
            >
              {checking ? 'Checking…' : 'Enter'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
