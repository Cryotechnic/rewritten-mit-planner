import { useState, useRef, useEffect } from 'react';

interface Props {
  onConfirm: (encounterName: string) => void;
  onJoinByCode?: () => void;
}

const SUGGESTIONS = [
  'The Unending Coil of Bahamut (Ultimate)',
  'The Weapon\'s Refrain (Ultimate)',
  'The Epic of Alexander (Ultimate)',
  'Dragonsong\'s Reprise (Ultimate)',
  'The Omega Protocol (Ultimate)',
  'Futures Rewritten (Ultimate)',
];

export default function Oobe({ onConfirm, onJoinByCode }: Props) {
  const [name, setName] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const confirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  const filtered = SUGGESTIONS.filter((s) =>
    s.toLowerCase().includes(name.toLowerCase()) && s !== name
  );
  const showSuggestions = focused && name.length > 0 && filtered.length > 0;

  return (
    <div className="oobe">
      <div className="oobe-card">
        <div className="oobe-logo-row">
          <img src="/ffxiv-icon.png" alt="" className="oobe-logo" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div>
            <h1 className="oobe-title">Rewritten Mitigation Planner</h1>
            <p className="oobe-subtitle">Plan and visualize raid mitigation for FFXIV savage &amp; ultimate content.</p>
          </div>
        </div>

        <div className="oobe-divider" />

        <div className="oobe-step">
          <span className="oobe-step-num">1</span>
          <div>
            <h2 className="oobe-step-title">Name your first encounter</h2>
            <p className="oobe-step-desc">You can add more plans and rename them at any time.</p>
          </div>
        </div>

        <div className="oobe-input-wrap">
          <input
            ref={inputRef}
            className="oobe-input"
            placeholder="e.g. The Unending Coil of Bahamut (Ultimate)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }}
            autoComplete="off"
          />
          {showSuggestions && (
            <ul className="oobe-suggestions">
              {filtered.map((s) => (
                <li key={s} className="oobe-suggestion" onMouseDown={() => { setName(s); inputRef.current?.focus(); }}>
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          className="oobe-btn"
          onClick={confirm}
          disabled={!name.trim()}
        >
          Get Started →
        </button>

        <p className="oobe-hint">All data is saved locally in your browser.</p>

        {onJoinByCode && (
          <>
            <div className="oobe-divider" />
            <div style={{ textAlign: 'center' }}>
              <p className="oobe-hint" style={{ marginBottom: '10px' }}>Have a session code from a teammate?</p>
              <button
                className="oobe-btn-secondary"
                onClick={onJoinByCode}
              >
                Open session by code
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
