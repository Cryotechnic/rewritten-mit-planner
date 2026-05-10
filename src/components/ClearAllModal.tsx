import type React from 'react';
import { useStore } from '../store';
import { t } from '../i18n';

interface Props {
  phaseName: string;
  planName: string;
  onClearPhase: () => void;
  onClearPlan: () => void;
  onClearAll: () => void;
  onCancel: () => void;
}

const WARNING_STYLE: React.CSSProperties = {
  margin: '0 0 20px',
  color: 'var(--text-dim, #9ca3af)',
  fontSize: 13,
  lineHeight: 1.5,
};

const SCOPE_BTNS: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  marginBottom: 20,
};

const SCOPE_BTN_BASE: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 6,
  border: '1px solid',
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: 13,
  background: 'transparent',
};

export default function ClearAllModal({ phaseName, planName, onClearPhase, onClearPlan, onClearAll, onCancel }: Props) {
  const { language } = useStore();
  return (
    <div className="encounter-dialog-overlay" onClick={onCancel}>
      <div className="encounter-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <h2 className="encounter-dialog-title" style={{ color: '#f87171' }}>{t('clearTitle', language)}</h2>
        <p style={WARNING_STYLE}>{t('clearScopeChoose', language)} <strong style={{ color: '#fca5a5' }}>{t('clearWarning', language)}</strong></p>
        <div style={SCOPE_BTNS}>
          <button
            style={{ ...SCOPE_BTN_BASE, borderColor: '#4b5563', color: '#d1d5db' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1f2937'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            onClick={onClearPhase}
          >
            <strong>{t('clearPhaseLabel', language)}</strong> — {phaseName}
          </button>
          <button
            style={{ ...SCOPE_BTN_BASE, borderColor: '#92400e', color: '#fbbf24' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1c1208'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            onClick={onClearPlan}
          >
            <strong>{t('clearPlanLabel', language)}</strong> — {planName}
          </button>
          <button
            style={{ ...SCOPE_BTN_BASE, borderColor: '#7f1d1d', color: '#f87171' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1c0808'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            onClick={onClearAll}
          >
            <strong>{t('clearAllLabel', language)}</strong> — {t('clearAllDesc', language)}
          </button>
        </div>
        <div className="encounter-dialog-actions">
          <button className="encounter-dialog-cancel" onClick={onCancel}>{t('btnCancel', language)}</button>
        </div>
      </div>
    </div>
  );
}
