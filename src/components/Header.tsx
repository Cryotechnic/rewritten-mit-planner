import { useState } from 'react';
import { useStore } from '../store';
import EncounterDialog from './EncounterDialog';
import type { UcobData, Phase } from '../types';

interface Props {
  data: UcobData;
  allPhases: Phase[];
}

const LANGS = ['JP', 'EN', 'DE', 'FR', 'KO', 'CN'] as const;
const ENCOUNTER_LEVELS = [50, 60, 70, 80, 90, 100] as const;

export default function Header({ data, allPhases }: Props) {
  const { setActivePhase, language, setLanguage, maxHP, tankHP, setMaxHP, setTankHP, encounterLevel, setEncounterLevel, plans, activePlanId, toggleHidePhase, addCustomPhase, removeCustomPhase } = useStore();
  const activePlan = plans[activePlanId];
  const activePhaseIdx = activePlan.activePhaseIdx;
  const hiddenPhases = activePlan.hiddenPhases ?? new Set<number>();
  const hiddenPhaseList = allPhases.map((p, i) => ({ phase: p, idx: i })).filter(({ idx }) => hiddenPhases.has(idx));
  const [showRestoreMenu, setShowRestoreMenu] = useState(false);
  const [showAddPhase, setShowAddPhase] = useState(false);
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
            const visibleCount = allPhases.filter((_, i) => !hiddenPhases.has(i)).length;
            if (isHidden) return null;
            return (
              <div key={idx} className="phase-tab-wrap">
                <button
                  className={`phase-tab ${activePhaseIdx === idx ? 'active' : ''} ${isCustom ? 'phase-tab-custom' : ''}`}
                  onClick={() => setActivePhase(idx)}
                >
                  {phase.name}
                </button>
                {isCustom ? (
                  <button
                    className="phase-tab-hide-btn phase-tab-delete-btn"
                    onClick={() => removeCustomPhase(idx, data.phases.length)}
                    title={`Delete ${phase.name}`}
                  >🗑</button>
                ) : visibleCount > 1 && (
                  <button
                    className="phase-tab-hide-btn"
                    onClick={() => toggleHidePhase(idx, totalPhases)}
                    title={`Hide ${phase.name}`}
                  >×</button>
                )}
              </div>
            );
          })}
          {/* Add custom phase */}
          <button
            className="phase-tab-restore-btn"
            onClick={() => setShowAddPhase(true)}
            title="Add custom phase"
          >+</button>
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
        {showAddPhase && (
          <EncounterDialog
            mode="new"
            title="New Phase"
            label="Phase Name"
            placeholder="e.g. Phase 6"
            confirmLabel="Add Phase"
            onConfirm={(name) => { addCustomPhase(name, data.phases.length); setShowAddPhase(false); }}
            onCancel={() => setShowAddPhase(false)}
          />
        )}

        {/* Language */}
        <div className="control-group">
          <label>Language</label>
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
          <label>Party HP</label>
          <input
            type="number"
            className="hp-input"
            value={maxHP}
            onChange={(e) => setMaxHP(Number(e.target.value))}
            step={1000}
          />
        </div>
        <div className="control-group">
          <label>Tank HP</label>
          <input
            type="number"
            className="hp-input"
            value={tankHP}
            onChange={(e) => setTankHP(Number(e.target.value))}
            step={1000}
          />
        </div>
        <div className="control-group">
          <label>Encounter Level</label>
          <div className="lang-buttons">
            {ENCOUNTER_LEVELS.map((lv) => (
              <button
                key={lv}
                className={`lang-btn ${encounterLevel === lv ? 'active' : ''}`}
                onClick={() => setEncounterLevel(lv)}
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
