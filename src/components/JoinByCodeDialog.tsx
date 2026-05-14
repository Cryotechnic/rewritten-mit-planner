import { useState } from 'react';

const CODE_RE = /^[A-Z0-9]{6}$/i;

interface Props {
  onJoin: (code: string) => void;
  onCancel: () => void;
  checking?: boolean;
  error?: string | null;
}

export function JoinByCodeDialog({ onJoin, onCancel, checking, error }: Props) {
  const [code, setCode] = useState('');
  const valid = CODE_RE.test(code.trim());

  const canSubmit = valid && !checking;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.65)',
      zIndex: 1000,
    }}>
      <div className="join-code-dialog-card">
        <div style={{ fontWeight: 700, fontSize: '17px', color: 'var(--text)' }}>
          Join session by code
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Enter the 6-character session code to open it in view-only mode.
          For edit access, use the full invite link shared by the session owner.
        </div>
        <input
          autoFocus
          type="text"
          placeholder="XXXXXX"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSubmit) onJoin(code.trim());
            if (e.key === 'Escape') onCancel();
          }}
          maxLength={6}
          className="join-code-input"
          disabled={checking}
          style={{
            background: 'var(--surface2)',
            border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
            borderRadius: '6px',
            color: 'var(--text)',
            fontSize: '22px',
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.25em',
            padding: '10px 12px',
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
            textAlign: 'center',
          }}
        />
        {error && (
          <div style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '-6px' }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onCancel}
            disabled={checking}
            style={{
              background: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '8px 14px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: checking ? 'not-allowed' : 'pointer',
              opacity: checking ? 0.5 : 1,
              flex: 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => canSubmit && onJoin(code.trim())}
            disabled={!canSubmit}
            style={{
              background: canSubmit ? 'var(--accent)' : 'var(--surface2)',
              color: canSubmit ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 14px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              flex: 1,
            }}
          >
            {checking ? 'Checking…' : 'Open (View-only)'}
          </button>
        </div>
      </div>
    </div>
  );
}
