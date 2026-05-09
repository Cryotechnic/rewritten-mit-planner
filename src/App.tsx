import { useState } from "react";
import commitHash from 'virtual:git-hash';
import ucobData from "./data/ucob_data.json";
import type { UcobData } from "./types";
import Header from "./components/Header";
import PlanTabBar from "./components/PlanTabBar";
import EncounterDialog from "./components/EncounterDialog";
import SkillDatabase from "./components/SkillDatabase";
import MitigationGrid from "./components/MitigationGrid";
import { useStore } from "./store";
import "./App.css";

const data = ucobData as unknown as UcobData;

type Tab = "planner" | "skills";

export default function App() {
  const { plans, activePlanId, renamePlan } = useStore();
  const [tab, setTab] = useState<Tab>("planner");

  const activePhaseIdx = plans[activePlanId].activePhaseIdx;
  const activePlan = plans[activePlanId];
  const activePhase = data.phases[activePhaseIdx];

  return (
    <div className="app">
      {!activePlan.name && (
        <EncounterDialog
          mode="oobe"
          onConfirm={(encounterName) => renamePlan(activePlanId, encounterName)}
        />
      )}
      <Header data={data} />
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
        {tab === "skills" && <SkillDatabase skills={data.skills} />}
      </main>

      <footer className="app-footer">
        <span>Rewritten Mitigation Planner</span>
        <span className="footer-version">{commitHash}</span>
      </footer>
    </div>
  );
}
