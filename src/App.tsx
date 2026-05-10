import { useState, useMemo } from "react";
import commitHash from 'virtual:git-hash';
import ucobData from "./data/ucob_data.json";
import type { UcobData, Phase } from "./types";
import Header from "./components/Header";
import PlanTabBar from "./components/PlanTabBar";
import EncounterDialog from "./components/EncounterDialog";
import Oobe from "./components/Oobe";
import SkillDatabase from "./components/SkillDatabase";
import MitigationGrid from "./components/MitigationGrid";
import { useStore } from "./store";
import "./App.css";

const data = ucobData as unknown as UcobData;

// All unique skill columns across all data phases — used for custom phases
const allSkillCols = (() => {
  const seen = new Set<string>();
  const cols: UcobData['phases'][0]['skillCols'] = [];
  for (const phase of data.phases) {
    for (const sc of phase.skillCols) {
      if (!seen.has(sc.col)) { seen.add(sc.col); cols.push(sc); }
    }
  }
  return cols;
})();

type Tab = "planner" | "skills";

export default function App() {
  const { plans, activePlanId, renamePlan, addCustomPhase } = useStore();
  const [tab, setTab] = useState<Tab>("planner");
  const [showAddPhase, setShowAddPhase] = useState(false);

  const activePhaseIdx = plans[activePlanId].activePhaseIdx;
  const activePlan = plans[activePlanId];

  // Build combined phase list: data phases + custom phases
  const customPhaseEntries = activePlan.customPhases ?? [];
  const allPhases = useMemo<Phase[]>(
    () => [
      ...data.phases,
      ...customPhaseEntries.map((cp) => ({ name: cp.name, skillCols: allSkillCols, actions: [] as Phase['actions'] })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customPhaseEntries.length, customPhaseEntries.map((c) => c.name).join('\0')]
  );
  const hiddenPhases = activePlan.hiddenPhases ?? new Set<number>();
  const activePhase = !hiddenPhases.has(activePhaseIdx) ? allPhases[activePhaseIdx] : undefined;

  if (!activePlan.name) {
    return <Oobe onConfirm={(encounterName) => renamePlan(activePlanId, encounterName)} />;
  }

  return (
    <div className="app">
      <Header data={data} allPhases={allPhases} onAddPhase={() => setShowAddPhase(true)} />
      <PlanTabBar />

      <div className="tab-bar">
        <button
          className={`tab ${tab === "planner" ? "active" : ""}`}
          onClick={() => setTab("planner")}
        >
          Mitigation Planner
        </button>
        <button
          className={`tab ${tab === "skills" ? "active" : ""}`}
          onClick={() => setTab("skills")}
        >
          Skill Reference
        </button>
      </div>

      <main className="main">
        {tab === "planner" && activePhase && (
          <MitigationGrid
            key={`${activePlanId}-${activePhaseIdx}`}
            phaseIdx={activePhaseIdx}
            phase={activePhase}
            skills={data.skills}
          />
        )}
        {tab === "planner" && !activePhase && (
          <div className="no-phase-empty">
            <p className="no-phase-hint">No phases visible</p>
            <button className="no-phase-add-btn" onClick={() => setShowAddPhase(true)}>+ Add Phase</button>
          </div>
        )}
        {tab === "skills" && <SkillDatabase skills={data.skills} />}
      </main>

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

      <footer className="app-footer">
        <span>Rewritten Mitigation Planner</span>
        <span className="footer-version">{commitHash}</span>
      </footer>
    </div>
  );
}
