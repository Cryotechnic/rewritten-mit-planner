import { useStore } from '../store';
import type { UcobData } from '../types';

interface Props {
  data: UcobData;
}

const LANGS = ['JP', 'EN', 'DE', 'FR', 'KO', 'CN'] as const;
const ENCOUNTER_LEVELS = [50, 60, 70, 80, 90, 100] as const;

export default function Header({ data }: Props) {
  const { setActivePhase, language, setLanguage, maxHP, tankHP, setMaxHP, setTankHP, encounterLevel, setEncounterLevel, plans, activePlanId } = useStore();
  const activePhaseIdx = plans[activePlanId].activePhaseIdx;

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
          {data.phases.map((phase, idx) => (
            <button
              key={idx}
              className={`phase-tab ${activePhaseIdx === idx ? 'active' : ''}`}
              onClick={() => setActivePhase(idx)}
            >
              {phase.name}
            </button>
          ))}
        </nav>

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
