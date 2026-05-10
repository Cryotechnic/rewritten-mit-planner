import React, { useState } from 'react';

const CODE_HASH = import.meta.env.VITE_ACCESS_CODE_HASH as string | undefined;
const SESSION_KEY = 'mit-planner-auth';

async function sha256(message: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
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

  // Already authed in this session
  if (authed) return <>{children}</>;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError(false);
    const hash = await sha256(input.trim());
    if (hash === CODE_HASH) {
      sessionStorage.setItem(SESSION_KEY, CODE_HASH);
      setAuthed(true);
    } else {
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
        <input
          type="password"
          autoFocus
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(false); }}
          placeholder="Passphrase"
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
            Incorrect passphrase.
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
      </form>
    </div>
  );
}
