import { useState, useRef, useEffect, startTransition } from 'react';
import { useStore } from '../store';
import type { EncounterData, Phase } from '../types';
import { t } from '../i18n';

interface Props {
  data: EncounterData;
  allPhases: Phase[];
  onAddPhase: () => void;
  onJoinByCode?: () => void;
  onShowChangelog?: () => void;
}

const LANGS = ['JP', 'EN', 'DE', 'FR', 'KO', 'CN'] as const;
const ENCOUNTER_LEVELS = [50, 60, 70, 80, 90, 100] as const;

export default function Header({ data, allPhases, onAddPhase, onJoinByCode: _onJoinByCode, onShowChangelog }: Props) {
  const { setActivePhase, language, setLanguage, maxHP, tankHP, setMaxHP, setTankHP, encounterLevel, setEncounterLevel, plans, activePlanId, toggleHidePhase, removeCustomPhase, renamePhase, viewerMode } = useStore();
  const activePlan = plans[activePlanId];
  const activePhaseIdx = activePlan.activePhaseIdx;
  const hiddenPhases = activePlan.hiddenPhases ?? new Set<number>();
  const hiddenPhaseList = allPhases.map((p, i) => ({ phase: p, idx: i })).filter(({ idx }) => hiddenPhases.has(idx));
  const [showRestoreMenu, setShowRestoreMenu] = useState(false);
  const [editingPhaseIdx, setEditingPhaseIdx] = useState<number | null>(null);
  const [editPhaseName, setEditPhaseName] = useState('');
  const phaseInputRef = useRef<HTMLInputElement>(null);
  const totalPhases = allPhases.length;

  useEffect(() => {
    if (editingPhaseIdx !== null) phaseInputRef.current?.select();
  }, [editingPhaseIdx]);

  const commitPhaseRename = () => {
    if (editingPhaseIdx !== null && editPhaseName.trim()) {
      renamePhase(editingPhaseIdx, editPhaseName.trim());
    }
    setEditingPhaseIdx(null);
  };

  return (
    <header className="header">
      <div className="header-title">
        <img src="/ffxiv-icon.png" alt="" className="logo" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        <h1>Rewritten Mitigation Planner</h1>
        {plans[activePlanId].name && (
          <span className="subtitle">{plans[activePlanId].name}</span>
        )}
      </div>

      <div className="header-controls">
        {/* Phase tabs */}
        <nav className="phase-tabs">
          {allPhases.map((phase, idx) => {
            const isHidden = hiddenPhases.has(idx);
            const isCustom = idx >= data.phases.length;
            if (isHidden) return null;
            return (
              <div key={idx} className="phase-tab-wrap">
                {editingPhaseIdx === idx ? (
                  <input
                    ref={phaseInputRef}
                    value={editPhaseName}
                    size={Math.max(editPhaseName.length + 1, 4)}
                    onChange={(e) => setEditPhaseName(e.target.value)}
                    onBlur={commitPhaseRename}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitPhaseRename(); if (e.key === 'Escape') setEditingPhaseIdx(null); }}
                    style={{ padding: '4px 8px', fontSize: '12px', fontFamily: 'inherit', background: '#1e2235', color: '#e2e8f0', border: '1px solid #4f6fff', borderRadius: '4px', outline: 'none', boxSizing: 'content-box' }}
                  />
                ) : (
                <button
                  className={`phase-tab ${activePhaseIdx === idx ? 'active' : ''} ${isCustom ? 'phase-tab-custom' : ''}`}
                  onClick={() => startTransition(() => setActivePhase(idx))}
                  onDoubleClick={() => { if (!viewerMode) { setEditingPhaseIdx(idx); setEditPhaseName(phase.name); } }}
                >
                  {phase.name}
                </button>
                )}
                {isCustom ? (
                  !viewerMode && (
                  <button
                    className="phase-tab-hide-btn phase-tab-delete-btn"
                    onClick={(e) => { e.stopPropagation(); removeCustomPhase(idx, data.phases.length); }}
                    title={`Delete ${phase.name}`}
                  >×</button>
                  )
                ) : (
                  !viewerMode && (
                  <button
                    className="phase-tab-hide-btn"
                    onClick={() => toggleHidePhase(idx, totalPhases)}
                    title={`Hide ${phase.name}`}
                  >×</button>
                  )
                )}
              </div>
            );
          })}
          {/* Add custom phase */}
          {!viewerMode && (
          <button
            className="phase-tab-restore-btn"
            onClick={() => onAddPhase()}
            title="Add custom phase"
          >+</button>
          )}
          {/* Restore hidden phases */}
          {hiddenPhaseList.length > 0 && (
            <div className="phase-tab-restore-wrap">
              <button
                className="phase-tab-restore-btn phase-tab-restore-hidden-btn"
                onClick={() => setShowRestoreMenu((v) => !v)}
                title="Restore hidden phases"
              >↩</button>
              {showRestoreMenu && (
                <div className="phase-restore-menu">
                  {hiddenPhaseList.map(({ phase, idx }) => (
                    <button
                      key={idx}
                      className="phase-restore-item"
                      onClick={() => { toggleHidePhase(idx, totalPhases); setShowRestoreMenu(false); }}
                    >
                      + {phase.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Language */}
        <div className="control-group">
          <label>{t('labelLanguage', language)}</label>
          <div className="lang-buttons">
            {LANGS.map((l) => (
              <button
                key={l}
                className={`lang-btn ${language === l ? 'active' : ''}`}
                onClick={() => setLanguage(l)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* What's New */}
        <button
          className="lang-btn"
          onClick={() => onShowChangelog?.()}
          title="What's New"
          style={{ fontSize: 11, opacity: 0.75 }}
        >
          What's New
        </button>

        {/* HP settings */}
        <div className="control-group">
          <label>{t('labelPartyHP', language)}</label>
          <input
            type="number"
            className="hp-input"
            value={maxHP}
            onChange={(e) => setMaxHP(Number(e.target.value))}
            step={1000}
            disabled={viewerMode}
          />
        </div>
        <div className="control-group">
          <label>{t('labelTankHP', language)}</label>
          <input
            type="number"
            className="hp-input"
            value={tankHP}
            onChange={(e) => setTankHP(Number(e.target.value))}
            step={1000}
            disabled={viewerMode}
          />
        </div>
        <div className="control-group">
          <label>{t('labelEncLevel', language)}</label>
          <div className="lang-buttons">
            {ENCOUNTER_LEVELS.map((lv) => (
              <button
                key={lv}
                className={`lang-btn ${encounterLevel === lv ? 'active' : ''}`}
                onClick={() => setEncounterLevel(lv)}
                disabled={viewerMode}
              >
                {lv}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
