import { useState, useMemo, useEffect, useRef } from "react";
import commitHash from 'virtual:git-hash';
import ucobData from "./data/ucob_data.json";
import skillsData from "./data/skills.json";
import type { EncounterData, Phase } from "./types";
import type { PlanData } from "./store";
import Header from "./components/Header";
import PlanTabBar from "./components/PlanTabBar";
import EncounterDialog from "./components/EncounterDialog";
import Oobe from "./components/Oobe";
import SkillDatabase from "./components/SkillDatabase";
import MitigationGrid from "./components/MitigationGrid";
import { useStore } from "./store";
import { pushPlan, subscribePlan, generateShareId } from "./lib/planSync";
import type { Unsubscribe } from "firebase/firestore";
import { t } from "./i18n";

const data = ucobData as unknown as EncounterData;
const skills = skillsData as unknown as import('./types').Skill[];

// All unique skill columns across all data phases — used for custom phases
const allSkillCols = (() => {
  const seen = new Set<string>();
  const cols: EncounterData['phases'][0]['skillCols'] = [];
  for (const phase of data.phases) {
    for (const sc of phase.skillCols) {
      if (!seen.has(sc.col)) { seen.add(sc.col); cols.push(sc); }
    }
  }
  return cols;
})();

type Tab = "planner" | "skills";

export default function App() {
  const { plans, activePlanId, renamePlan, addCustomPhase, shareId, clientId, setShareId, applyRemotePlan, maxHP, tankHP, encounterLevel, language } = useStore();
  const [tab, setTab] = useState<Tab>("planner");
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const unsubRef = useRef<Unsubscribe | null>(null);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Suppress echo after applying a remote update
  const skipNextPushRef = useRef(false);
  // Suppress initial push when joining (so we don't overwrite the sharer's data)
  const awaitingFirstSyncRef = useRef(false);

  // On mount: check URL for ?join=XXXXXX, or auto-share if not already sharing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    if (joinId) {
      awaitingFirstSyncRef.current = true; // joiner: wait for first remote before pushing
      setShareId(joinId.toUpperCase());
      const url = new URL(window.location.href);
      url.searchParams.delete('join');
      window.history.replaceState({}, '', url.toString());
    } else if (!shareId) {
      const id = generateShareId();
      setShareId(id);
      const { plans: p, activePlanId: aid, maxHP: mhp, tankHP: thp, encounterLevel: el } = useStore.getState();
      pushPlan(id, p, aid, clientId, { maxHP: mhp, tankHP: thp, encounterLevel: el }).catch((err) => {
        console.error('Failed to create session:', err);
        setShareError('Could not create a sync session. Check your Firebase config or Firestore rules.');
      });
    }
  }, []);

  // Subscribe / unsubscribe when shareId changes
  useEffect(() => {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    if (!shareId) return;
    unsubRef.current = subscribePlan(shareId, clientId, (remotePlans, remoteActivePlanId, remoteSettings) => {
      awaitingFirstSyncRef.current = false;
      skipNextPushRef.current = true;
      applyRemotePlan(remotePlans as Record<string, PlanData>, remoteActivePlanId, remoteSettings);
    });
    return () => { unsubRef.current?.(); unsubRef.current = null; };
  }, [shareId, clientId]);

  // Push full plans snapshot to Firestore (debounced 600ms).
  // Skipped on echo or while waiting for the first remote update (join flow).
  const activePlanForSync = plans[activePlanId];
  useEffect(() => {
    if (!shareId) return;
    if (awaitingFirstSyncRef.current) return;
    if (skipNextPushRef.current) {
      skipNextPushRef.current = false;
      return;
    }
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      pushPlan(shareId, plans, activePlanId, clientId, { maxHP, tankHP, encounterLevel }).catch(console.error);
    }, 600);
    return () => { if (pushTimerRef.current) clearTimeout(pushTimerRef.current); };
  }, [shareId, clientId, activePlanForSync, plans, activePlanId, maxHP, tankHP, encounterLevel]);

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
          {t('tabPlanner', language)}
        </button>
        <button
          className={`tab ${tab === "skills" ? "active" : ""}`}
          onClick={() => setTab("skills")}
        >
          {t('tabSkills', language)}
        </button>
      </div>

      <main className="main">
        {tab === "planner" && activePhase && (
          <MitigationGrid
            key={`${activePlanId}-${activePhaseIdx}`}
            phaseIdx={activePhaseIdx}
            phase={activePhase}
            skills={skills}
          />
        )}
        {tab === "planner" && !activePhase && (
          <div className="no-phase-empty">
            <p className="no-phase-hint">{t('btnNoPhase', language)}</p>
            <button className="no-phase-add-btn" onClick={() => setShowAddPhase(true)}>+ {t('btnAddPhase', language).replace(/^\+ /, '')}</button>
          </div>
        )}
        {tab === "skills" && <SkillDatabase skills={skills} />}
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
      {shareError && (
        <div className="share-error-banner">
          ⚠ {shareError}
          <button onClick={() => setShareError(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
