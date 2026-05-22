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
import ChangelogModal from "./components/ChangelogModal";
import { PipPortal, type PipWindowHandle } from "./components/JobPipWindow";
import { SharePasswordSetup, JoinPasswordPrompt } from "./components/SessionPasswordDialog";
import { JoinByCodeDialog } from "./components/JoinByCodeDialog";
import { useStore } from "./store";
import { pushPlan, subscribePlan, generateShareId, generateWriteToken, getSessionMeta, validateSessionPassword } from "./lib/planSync";
import type { Unsubscribe } from "firebase/firestore";
import { t } from "./i18n";
import { CURRENT_VERSION } from "./data/changelog";

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
  const { plans, activePlanId, renamePlan, addCustomPhase, shareId, clientId, setShareId, applyRemotePlan, maxHP, tankHP, encounterLevel, language, viewerMode, toggleViewerMode, setWriteToken, resetPlans, allowCooldownOverride, lastSeenVersion, setLastSeenVersion } = useStore();
  const [tab, setTab] = useState<Tab>("planner");
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const unsubRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    const base = 'Rewritten Mitigation Planner';
    document.title = viewerMode ? `[VIEW-ONLY] ${base}` : base;
  }, [viewerMode]);

  // Show changelog on first visit or after an update
  useEffect(() => {
    if (lastSeenVersion !== CURRENT_VERSION) {
      setShowChangelog(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Suppress echo after applying a remote update
  const skipNextPushRef = useRef(false);
  // Suppress initial push when joining or reconnecting (so we don't overwrite remote data)
  const awaitingFirstSyncRef = useRef(!!shareId);

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
  const [showJoinByCode, setShowJoinByCode] = useState(false);
  const [sessionDeleted, setSessionDeleted] = useState(false);
  const [joiningCodeChecking, setJoiningCodeChecking] = useState(false);
  const [joiningCodeError, setJoiningCodeError] = useState<string | null>(null);
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
      else { if (!viewerMode) toggleViewerMode(); } // no token = read-only
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
    } else if (shareId) {
      // Persisted session — reconnect without creating a new one or clearing plan data.
      // awaitingFirstSyncRef is already true (initialized from shareId), so the push
      // effect won't fire until the first remote sync arrives.
      const { writeToken: persistedToken } = useStore.getState();
      if (persistedToken) writeTokenRef.current = persistedToken;
      getSessionMeta(shareId).then(({ exists, encrypted }) => {
        if (!exists) {
          // Session expired — drop it and let the user start fresh
          setShareId(null);
          setWriteToken(null);
          awaitingFirstSyncRef.current = false;
        } else if (encrypted) {
          setNeedJoinPassword(true);
        }
      }).catch(() => {
        setShareError('Could not reach the sync session. Check your connection.');
      });
    } else {
      // Sharer: generate ID + write token, prompt for optional password
      // Reset all plans so sharing always starts from a blank slate
      resetPlans();
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
    // Suppress the debounced push effect so only this explicit pushPlan call
    // creates the Firebase document (prevents a double-write on session creation).
    awaitingFirstSyncRef.current = true;
    setShareId(id); // triggers subscribe effect
    const { plans: p, activePlanId: aid, maxHP: mhp, tankHP: thp, encounterLevel: el } = useStore.getState();
    pushPlan(id, p, aid, clientId, { maxHP: mhp, tankHP: thp, encounterLevel: el, allowCooldownOverride: useStore.getState().allowCooldownOverride }, password ?? undefined, writeTokenRef.current ?? undefined).then(() => {
      // Allow subsequent edits to sync after the initial push succeeds.
      awaitingFirstSyncRef.current = false;
    }).catch((err) => {
      console.error('Failed to create session:', err);
      awaitingFirstSyncRef.current = false;
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

  function handleJoinByCode(code: string) {
    const id = code.trim().toUpperCase();
    setJoiningCodeChecking(true);
    setJoiningCodeError(null);
    // Pre-validate against the allowed charset before hitting Firestore,
    // so invalid chars produce "not found" rather than a permission error.
    const VALID_RE = /^[A-HJ-NP-Z2-9]{6}$/;
    if (!VALID_RE.test(id)) {
      setJoiningCodeChecking(false);
      setJoiningCodeError('Session not found. Check the code and try again.');
      return;
    }
    getSessionMeta(id).then(({ exists, encrypted }) => {
      setJoiningCodeChecking(false);
      if (!exists) {
        setJoiningCodeError('Session not found. Check the code and try again.');
        return;
      }
      setShowJoinByCode(false);
      setJoiningCodeError(null);
      awaitingFirstSyncRef.current = true;
      setShareId(id);
      if (!viewerMode) toggleViewerMode();
      if (encrypted) setNeedJoinPassword(true);
    }).catch((err) => {
      setJoiningCodeChecking(false);
      // Firestore permission-denied = invalid code format slipped through
      if (err?.code === 'permission-denied') {
        setJoiningCodeError('Session not found. Check the code and try again.');
      } else {
        setJoiningCodeError('Could not reach the sync session. Check your connection.');
      }
    });
  }

  function handleLeave() {
    // Tear down current session
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    setShareId(null);
    setWriteToken(null);
    setSessionPassword(null);
    setNeedJoinPassword(false);
    setWaitingForHost(false);
    if (viewerMode) toggleViewerMode();
    awaitingFirstSyncRef.current = false;
    skipNextPushRef.current = false;
    // Start a brand-new session setup flow
    resetPlans();
    const id = generateShareId();
    const token = generateWriteToken();
    pendingShareIdRef.current = id;
    writeTokenRef.current = token;
    setWriteToken(token);
    setShowPasswordSetup(true);
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
    }, () => {
      // Doc existed but was deleted (e.g. by admin)
      setSessionDeleted(true);
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
      pushPlan(shareId, plans, activePlanId, clientId, { maxHP, tankHP, encounterLevel, allowCooldownOverride }, sessionPassword ?? undefined, writeTokenRef.current ?? undefined).catch((err) => {
        console.error(err);
        if (err?.code === 'permission-denied') {
          setShareError('Write access denied — your write token may be invalid or missing. Try rejoining with the full share link.');
        }
      });
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
    return (
      <>
        <SharePasswordSetup
          shareUrl={shareUrl}
          viewUrl={viewUrl}
          onConfirm={handleSharerPasswordConfirm}
          onJoinByCode={() => { setShowPasswordSetup(false); setShowJoinByCode(true); }}
        />
        {showJoinByCode && (
          <JoinByCodeDialog
            onJoin={handleJoinByCode}
            onCancel={() => { setShowJoinByCode(false); setJoiningCodeChecking(false); setJoiningCodeError(null); }}
            checking={joiningCodeChecking}
            error={joiningCodeError}
          />
        )}
      </>
    );
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
        onCancel={handleLeave}
      />
    );
  }

  if (showJoinByCode) {
    return (
      <JoinByCodeDialog
        onJoin={handleJoinByCode}
        onCancel={() => { setShowJoinByCode(false); setJoiningCodeChecking(false); setJoiningCodeError(null); }}
        checking={joiningCodeChecking}
        error={joiningCodeError}
      />
    );
  }

  if (!activePlan.name) {
    return <Oobe onConfirm={(encounterName) => renamePlan(activePlanId, encounterName)} onJoinByCode={() => setShowJoinByCode(true)} />;
  }

  return (
    <div className="app">
      <Header data={data} allPhases={allPhases} onAddPhase={() => setShowAddPhase(true)} onJoinByCode={() => setShowJoinByCode(true)} onShowChangelog={() => setShowChangelog(true)} />
      <PlanTabBar onJoinByCode={() => setShowJoinByCode(true)} onLeave={handleLeave} />

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
        <span className="footer-divider">·</span>
        <span>© {new Date().getFullYear() > 2026 ? `2026–${new Date().getFullYear()}` : '2026'} Aya Flowis @ Famfrit. All rights reserved.</span>
        <span className="footer-divider">·</span>
        <span className="footer-version">{commitHash}</span>
      </footer>
      {showChangelog && (
        <ChangelogModal onClose={() => { setLastSeenVersion(CURRENT_VERSION); setShowChangelog(false); }} />
      )}
      {shareError && (
        <div className="share-error-banner">
          ⚠ {shareError}
          <button onClick={() => setShareError(null)}>✕</button>
        </div>
      )}
      {showJoinByCode && (
        <JoinByCodeDialog
          onJoin={handleJoinByCode}
          onCancel={() => { setShowJoinByCode(false); setJoiningCodeChecking(false); setJoiningCodeError(null); }}
          checking={joiningCodeChecking}
          error={joiningCodeError}
        />
      )}
      {sessionDeleted && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="modal-title">Session Deleted</h2>
            <p className="modal-body">This session has been removed by an administrator. Your local plan data will be cleared.</p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => { setSessionDeleted(false); handleLeave(); }}>
                Go to Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
