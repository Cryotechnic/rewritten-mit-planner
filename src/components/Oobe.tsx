import { useState, useRef, useEffect } from 'react';
import type React from 'react';

interface Props {
  onConfirm: (encounterName: string) => void;
  onJoinByCode?: () => void;
  onBack?: () => void;
  skipDisclaimer?: boolean;
}

const SUGGESTIONS = [
  'The Unending Coil of Bahamut (Ultimate)',
  'The Weapon\'s Refrain (Ultimate)',
  'The Epic of Alexander (Ultimate)',
  'Dragonsong\'s Reprise (Ultimate)',
  'The Omega Protocol (Ultimate)',
  'Futures Rewritten (Ultimate)',
];

const DISCLAIMER_POINTS: React.ReactNode[] = [
  <>This is an <strong>unofficial fan tool</strong> and is <strong>not affiliated with, endorsed by, or connected to Square Enix Co., Ltd.</strong> FINAL FANTASY XIV and all related marks are trademarks of Square Enix.</>,
  <>By using this tool you agree that the <strong>website operator bears no liability</strong> for any outcome arising from plans created or shared here, including but not limited to in-game performance, wipes, or losses of any kind. <u><strong>Use at your own risk.</strong></u></>,
  <>This tool provides <strong>no guarantees of accuracy, availability, or fitness</strong> for any particular purpose. Mitigation values, cooldown timings, and other data <em>may be outdated or incorrect</em>.</>,
  <>Plan data is always synced to an online database to enable real-time collaboration. By using this tool, you acknowledge that your plan data (encounter names, action timings, and mitigation assignments) <strong>will be stored on remote servers.</strong> Keep plan and session names raid-relevant; do not use them to store personal details.</>,
  <><strong><u>Destructive actions such as closing a plan or clearing mitigations are permanent.</u></strong> There is no undo — once data is deleted it <em>cannot</em> be recovered.</>,
  <>The website operator reserves the right to <strong>modify, suspend, or terminate this service</strong>, and to <strong>delete any stored data</strong>, at any time and without prior notice.</>,
];

export default function Oobe({ onConfirm, onJoinByCode, onBack, skipDisclaimer }: Props) {
  const [step, setStep] = useState<'disclaimer' | 'name'>(skipDisclaimer ? 'name' : 'disclaimer');
  const [name, setName] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'name') inputRef.current?.focus();
  }, [step]);

  const confirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  const filtered = SUGGESTIONS.filter((s) =>
    s.toLowerCase().includes(name.toLowerCase()) && s !== name
  );
  const showSuggestions = focused && name.length > 0 && filtered.length > 0;

  if (step === 'disclaimer') {
    return (
      <div className="oobe">
        <div className="oobe-card">
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 56, lineHeight: 1 }}>⚠️</span>
          </div>
          <h1 className="oobe-title" style={{ textAlign: 'center', marginBottom: 4 }}>Before you continue</h1>
          <p className="oobe-subtitle" style={{ textAlign: 'center', marginBottom: 20 }}>Please read and agree to the following:</p>

          <ul style={{ margin: '0 0 24px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {DISCLAIMER_POINTS.map((point, i) => (
              <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.6, color: 'var(--text-muted, #9ca3af)' }}>
                <span style={{ color: 'var(--accent, #5b7dff)', fontWeight: 700, fontSize: 15, flexShrink: 0, marginTop: 1 }}>•</span>
                <span style={{ flex: 1 }}>{point}</span>
              </li>
            ))}
          </ul>

          <button className="oobe-btn" onClick={() => setStep('name')}>
            I Understand &amp; Agree →
          </button>
        </div>
      </div>
    );
  }

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

        {onBack && (
          <button
            className="oobe-btn-secondary"
            style={{ marginBottom: 8 }}
            onClick={onBack}
          >
            ← Back to share link
          </button>
        )}

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
