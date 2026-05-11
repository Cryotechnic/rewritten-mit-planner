import { useState, startTransition } from 'react';
import { useStore } from '../store';
import type { EncounterData, Phase } from '../types';
import { t } from '../i18n';

interface Props {
  data: EncounterData;
  allPhases: Phase[];
  onAddPhase: () => void;
}

const LANGS = ['JP', 'EN', 'DE', 'FR', 'KO', 'CN'] as const;
const ENCOUNTER_LEVELS = [50, 60, 70, 80, 90, 100] as const;

export default function Header({ data, allPhases, onAddPhase }: Props) {
  const { setActivePhase, language, setLanguage, maxHP, tankHP, setMaxHP, setTankHP, encounterLevel, setEncounterLevel, plans, activePlanId, toggleHidePhase, removeCustomPhase, viewerMode } = useStore();
  const activePlan = plans[activePlanId];
  const activePhaseIdx = activePlan.activePhaseIdx;
  const hiddenPhases = activePlan.hiddenPhases ?? new Set<number>();
  const hiddenPhaseList = allPhases.map((p, i) => ({ phase: p, idx: i })).filter(({ idx }) => hiddenPhases.has(idx));
  const [showRestoreMenu, setShowRestoreMenu] = useState(false);
  const totalPhases = allPhases.length;

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
                <button
                  className={`phase-tab ${activePhaseIdx === idx ? 'active' : ''} ${isCustom ? 'phase-tab-custom' : ''}`}
                  onClick={() => startTransition(() => setActivePhase(idx))}
                >
                  {phase.name}
                </button>
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
