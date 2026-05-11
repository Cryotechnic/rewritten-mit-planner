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
import { PipPortal, type PipWindowHandle } from "./components/JobPipWindow";
import { SharePasswordSetup, JoinPasswordPrompt } from "./components/SessionPasswordDialog";
import { useStore } from "./store";
import { pushPlan, subscribePlan, generateShareId, generateWriteToken, getSessionMeta, validateSessionPassword } from "./lib/planSync";
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
  const { plans, activePlanId, renamePlan, addCustomPhase, shareId, clientId, setShareId, applyRemotePlan, maxHP, tankHP, encounterLevel, language, viewerMode, toggleViewerMode, setWriteToken, clearPlanActions, allowCooldownOverride } = useStore();
  const [tab, setTab] = useState<Tab>("planner");
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const unsubRef = useRef<Unsubscribe | null>(null);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Suppress echo after applying a remote update
  const skipNextPushRef = useRef(false);
  // Suppress initial push when joining (so we don't overwrite the sharer's data)
  const awaitingFirstSyncRef = useRef(false);

  // Per-session encryption
  const pendingShareIdRef = useRef<string | null>(null);
  const writeTokenRef = useRef<string | null>(null);
  const initDoneRef = useRef(false);
  const [sessionPassword, setSessionPassword] = useState<string | null>(null);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [needJoinPassword, setNeedJoinPassword] = useState(false);
  const [joinPasswordChecking, setJoinPasswordChecking] = useState(false);
  const [joinPasswordError, setJoinPasswordError] = useState(false);
  const [waitingForHost, setWaitingForHost] = useState(false);
  const [pipHandle, setPipHandle] = useState<PipWindowHandle | null>(null);

  // On mount: check URL for ?join=XXXXXX, or start share setup
  useEffect(() => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    const viewId = params.get('view');
    if (viewId) {
      // View-only link: subscribe read-only, enable viewer mode
      const id = viewId.toUpperCase();
      awaitingFirstSyncRef.current = true;
      setShareId(id);
      if (!viewerMode) toggleViewerMode();
      const url = new URL(window.location.href);
      url.searchParams.delete('view');
      window.history.replaceState({}, '', url.toString());
      getSessionMeta(id).then(({ encrypted }) => {
        if (encrypted) setNeedJoinPassword(true);
      }).catch(() => {
        setShareError('Could not reach the sync session. Check your connection.');
      });
    } else if (joinId) {
      const id = joinId.toUpperCase();
      awaitingFirstSyncRef.current = true;
      // Parse write token from URL hash (#t=TOKEN)
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const token = hashParams.get('t');
      if (token) { writeTokenRef.current = token; setWriteToken(token); }
      setShareId(id);
      const url = new URL(window.location.href);
      url.searchParams.delete('join');
      window.history.replaceState({}, '', url.pathname + url.search); // strip hash too
      // Use getSessionMeta only as a quick early signal for the encrypted case.
      // The subscription's onWaiting callback handles the doc-doesn't-exist case.
      getSessionMeta(id).then(({ encrypted }) => {
        if (encrypted) setNeedJoinPassword(true);
      }).catch(() => {
        setShareError('Could not reach the sync session. Check your connection.');
      });
    } else if (!shareId) {
      // Sharer: generate ID + write token, prompt for optional password
      // Reset the active plan so sharing always starts from a blank slate
      clearPlanActions();
      const id = generateShareId();
      const token = generateWriteToken();
      pendingShareIdRef.current = id;
      writeTokenRef.current = token;
      setWriteToken(token);
      setShowPasswordSetup(true);
    }
  }, []);

  function handleSharerPasswordConfirm(password: string | null) {
    const id = pendingShareIdRef.current!;
    setSessionPassword(password);
    setShowPasswordSetup(false);
    setShareId(id); // triggers subscribe effect
    const { plans: p, activePlanId: aid, maxHP: mhp, tankHP: thp, encounterLevel: el } = useStore.getState();
    pushPlan(id, p, aid, clientId, { maxHP: mhp, tankHP: thp, encounterLevel: el, allowCooldownOverride: useStore.getState().allowCooldownOverride }, password ?? undefined, writeTokenRef.current ?? undefined).catch((err) => {
      console.error('Failed to create session:', err);
      setShareError('Could not create a sync session. Check your Firebase config or Firestore rules.');
    });
  }

  async function handleJoinPasswordSubmit(password: string) {
    if (!shareId) return;
    setJoinPasswordChecking(true);
    setJoinPasswordError(false);
    const ok = await validateSessionPassword(shareId, password);
    if (ok) {
      setSessionPassword(password);
      setNeedJoinPassword(false); // triggers subscribe effect
    } else {
      setJoinPasswordError(true);
    }
    setJoinPasswordChecking(false);
  }

  // Subscribe / unsubscribe when shareId or sessionPassword changes.
  // Intentionally NOT gated on needJoinPassword — we keep the subscription alive
  // so onSnapshot can fire onWaiting/onNeedsPassword even while the prompt is shown.
  useEffect(() => {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    if (!shareId) return;
    unsubRef.current = subscribePlan(shareId, clientId, (remotePlans, remoteActivePlanId, remoteSettings) => {
      awaitingFirstSyncRef.current = false;
      setWaitingForHost(false);
      skipNextPushRef.current = true;
      applyRemotePlan(remotePlans as Record<string, PlanData>, remoteActivePlanId, remoteSettings);
    }, sessionPassword ?? undefined, () => {
      // Encrypted doc arrived but we have no password — show prompt
      setNeedJoinPassword(true);
      setWaitingForHost(false);
    }, () => {
      // Doc doesn't exist yet — sharer hasn't pushed
      setWaitingForHost(true);
    });
    return () => { unsubRef.current?.(); unsubRef.current = null; };
  }, [shareId, clientId, sessionPassword]);

  // Push full plans snapshot to Firestore (debounced 600ms).
  // Skipped on echo or while waiting for the first remote update (join flow).
  const activePlanForSync = plans[activePlanId];
  useEffect(() => {
    if (!shareId || needJoinPassword || viewerMode) return;
    if (awaitingFirstSyncRef.current) return;
    if (skipNextPushRef.current) {
      skipNextPushRef.current = false;
      return;
    }
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      pushPlan(shareId, plans, activePlanId, clientId, { maxHP, tankHP, encounterLevel, allowCooldownOverride }, sessionPassword ?? undefined, writeTokenRef.current ?? undefined).catch(console.error);
    }, 600);
    return () => { if (pushTimerRef.current) clearTimeout(pushTimerRef.current); };
}, [shareId, clientId, needJoinPassword, sessionPassword, viewerMode, activePlanForSync, plans, activePlanId, maxHP, tankHP, encounterLevel, allowCooldownOverride]);

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

  if (showPasswordSetup && pendingShareIdRef.current) {
    const id = pendingShareIdRef.current;
    const token = writeTokenRef.current;
    const base = `${window.location.origin}${window.location.pathname}`;
    const shareUrl = token ? `${base}?join=${id}#t=${token}` : `${base}?join=${id}`;
    const viewUrl = `${base}?view=${id}`;
    return <SharePasswordSetup shareUrl={shareUrl} viewUrl={viewUrl} onConfirm={handleSharerPasswordConfirm} />;
  }

  if (waitingForHost && shareId) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', flexDirection: 'column', gap: '12px',
      }}>
        <div style={{ fontWeight: 700, fontSize: '17px', color: 'var(--text)' }}>Waiting for host…</div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Session <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{shareId}</span> hasn't started yet.
        </div>
      </div>
    );
  }

  if (needJoinPassword && shareId) {
    return (
      <JoinPasswordPrompt
        shareId={shareId}
        checking={joinPasswordChecking}
        error={joinPasswordError}
        onSubmit={handleJoinPasswordSubmit}
      />
    );
  }

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
            key={activePlanId}
            phaseIdx={activePhaseIdx}
            phase={activePhase}
            allPhases={allPhases}
            skills={skills}
            onOpenPip={setPipHandle}
          />
        )}
        {tab === "planner" && !activePhase && (
          <div className="no-phase-empty">
            <p className="no-phase-hint">{t('btnNoPhase', language)}</p>
            {!viewerMode && <button className="no-phase-add-btn" onClick={() => setShowAddPhase(true)}>+ {t('btnAddPhase', language).replace(/^\+ /, '')}</button>}
          </div>
        )}
        {tab === "skills" && <SkillDatabase skills={skills} />}
      </main>

      {pipHandle && (
        <PipPortal handle={pipHandle} allPhases={allPhases} skills={skills} onClose={() => setPipHandle(null)} />
      )}

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
