import { useState } from "react";
import ucobData from "./data/ucob_data.json";
import type { UcobData } from "./types";
import Header from "./components/Header";
import SkillDatabase from "./components/SkillDatabase";
import MitigationGrid from "./components/MitigationGrid";
import { useStore } from "./store";
import "./App.css";

const data = ucobData as unknown as UcobData;

type Tab = "planner" | "skills";

export default function App() {
  const { activePhaseIdx } = useStore();
  const [tab, setTab] = useState<Tab>("planner");

  const activePhase = data.phases[activePhaseIdx];

  return (
    <div className="app">
      <Header data={data} />

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
            key={activePhaseIdx}
            phaseIdx={activePhaseIdx}
            phase={activePhase}
            skills={data.skills}
          />
        )}
        {tab === "skills" && <SkillDatabase skills={data.skills} />}
      </main>

      <footer className="app-footer">
        <span>UCoB Mitigation Planner</span>
        <span className="footer-version">{__COMMIT_HASH__}</span>
      </footer>
    </div>
  );
}
