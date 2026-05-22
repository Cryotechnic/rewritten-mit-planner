import React, { useState } from 'react';

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg)',
  zIndex: 1000,
};

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '36px 40px',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  minWidth: '320px',
  maxWidth: '400px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
};

const inputStyle = (error: boolean): React.CSSProperties => ({
  background: 'var(--surface2)',
  border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
  borderRadius: '6px',
  color: 'var(--text)',
  fontSize: '14px',
  padding: '8px 12px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
});

const btnStyle = (primary: boolean, disabled = false): React.CSSProperties => ({
  background: primary ? 'var(--accent)' : 'transparent',
  color: primary ? '#fff' : 'var(--text-muted)',
  border: primary ? 'none' : '1px solid var(--border)',
  borderRadius: '6px',
  padding: '8px',
  fontWeight: 600,
  fontSize: '14px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  flex: 1,
});

// ── Sharer setup ─────────────────────────────────────────────────────────────

interface SetupProps {
  shareUrl: string;
  viewUrl: string;
  onConfirm: (password: string | null) => void;
  onJoinByCode?: () => void;
}

export function SharePasswordSetup({ shareUrl, viewUrl, onConfirm, onJoinByCode }: SetupProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: '17px', color: 'var(--text)' }}>
          New sync session
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Share this URL with your team. Optionally set a password; anyone joining the link will need to enter it.
        </div>

        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>EDIT LINK</div>
          <div style={{
            background: 'var(--surface2)', borderRadius: '6px',
            padding: '8px 12px', fontFamily: 'monospace', fontSize: '12px',
            color: 'var(--accent)', wordBreak: 'break-all', userSelect: 'all',
          }}>
            {shareUrl}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>VIEW-ONLY LINK</div>
          <div style={{
            background: 'var(--surface2)', borderRadius: '6px',
            padding: '8px 12px', fontFamily: 'monospace', fontSize: '12px',
            color: '#67e8f9', wordBreak: 'break-all', userSelect: 'all',
          }}>
            {viewUrl}
          </div>
        </div>

        <input
          type="password"
          placeholder="Session password (optional)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle(false)}
        />
        {password.length > 0 && (
          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={inputStyle(mismatch)}
          />
        )}
        {mismatch && (
          <div style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '-6px' }}>
            Passwords do not match.
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button style={btnStyle(false)} onClick={() => onConfirm(null)}>
            No password
          </button>
          <button
            style={btnStyle(true, password.length === 0 || mismatch)}
            disabled={password.length === 0 || mismatch}
            onClick={() => onConfirm(password)}
          >
            Set password
          </button>
        </div>

        {onJoinByCode && (
          <div style={{ textAlign: 'center', marginTop: '4px' }}>
            <button
              onClick={onJoinByCode}
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                fontSize: '12px', cursor: 'pointer', textDecoration: 'underline',
                padding: 0,
              }}
            >
              Join an existing session by code instead
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Joiner prompt ─────────────────────────────────────────────────────────────

interface JoinProps {
  shareId: string;
  checking: boolean;
  error: boolean;
  onSubmit: (password: string) => void;
  onCancel?: () => void;
}

export function JoinPasswordPrompt({ shareId, checking, error, onSubmit, onCancel }: JoinProps) {
  const [input, setInput] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || checking) return;
    onSubmit(input.trim());
  }

  return (
    <div style={overlayStyle}>
      <form onSubmit={handleSubmit} style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: '17px', color: 'var(--text)' }}>
          Password required
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Session <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{shareId}</span> is password-protected.
        </div>
        <input
          type="password"
          autoFocus
          placeholder="Session password"
          value={input}
          onChange={(e) => { setInput(e.target.value); }}
          disabled={checking}
          style={inputStyle(error)}
        />
        {error && (
          <div style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '-6px' }}>
            Incorrect password.
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          {onCancel && (
            <button type="button" style={btnStyle(false)} onClick={onCancel} disabled={checking}>
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!input.trim() || checking}
            style={btnStyle(true, !input.trim() || checking)}
          >
            {checking ? 'Checking…' : 'Join'}
          </button>
        </div>
      </form>
    </div>
  );
}
