import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Phase, Skill, Action, Language } from '../types';
import { useStore } from '../store';
import { JOB_ICON_URL } from '../jobIcons';

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(options?: { width?: number; height?: number }): Promise<Window & typeof globalThis>;
    };
  }
}

export interface PipSkill {
  name: string;
  icon: string | null;
}

export interface PipAction {
  actionName: string;
  timeSec: number | null;
  duration: number | null;
  skills: PipSkill[];
  note: string;
  phaseIdx: number;
  row: number;
}

export interface PipPhaseData {
  phaseName: string;
  actions: PipAction[];
}

export interface PipWindowHandle {
  win: Window & typeof globalThis;
  container: HTMLElement;
  jobJP: string;
  jobName: string;
}

// Helpers � prefixed pip* to avoid any HMR redeclaration collisions

function pipFormatElapsed(sec: number): string {
  const sign = sec < 0 ? '-' : '';
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = (abs % 60).toFixed(1).padStart(4, '0');
  return `${sign}${m}:${s}`;
}

function pipFormatCountdown(sec: number): string {
  if (sec <= 0) return 'NOW';
  if (sec < 60) return `${sec.toFixed(1)}s`;
  return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;
}

function pipGetSkill(nameJP: string, skills: Skill[], language: Language): PipSkill {
  const s = skills.find((sk) => sk.nameJP === nameJP);
  if (!s) return { name: nameJP, icon: null };
  let name: string;
  switch (language) {
    case 'EN': name = s.nameEN || nameJP; break;
    case 'DE': name = s.nameDE || s.nameEN || nameJP; break;
    case 'FR': name = s.nameFR || s.nameEN || nameJP; break;
    case 'KO': name = s.nameKO || s.nameEN || nameJP; break;
    case 'CN': name = s.nameCN || s.nameEN || nameJP; break;
    default: name = nameJP;
  }
  return { name, icon: s.icon ?? null };
}

function pipBuildPhases(
  jobJP: string,
  allPhases: Phase[],
  skills: Skill[],
  language: Language,
  mitGrid: Record<number, Record<number, Record<string, boolean>>>,
  actionOverrides: Record<number, Record<number, Partial<Action>>>,
  customActions: Record<number, Action[]>,
  baseActionsCleared: boolean,
  actionNotes: Record<number, Record<number, string>>,
): PipPhaseData[] {
  return allPhases.map((phase, pi) => {
    const jobCols = phase.skillCols.filter((sc) => sc.job === jobJP);
    const base = baseActionsCleared ? [] : phase.actions.filter((a): a is Action & { name: string } => !!a.name);
    const custom = customActions[pi] ?? [];
    const applyOv = (a: Action): Action => {
      const ov = actionOverrides[pi]?.[a.row];
      return ov ? { ...a, ...ov } : a;
    };
    const merged = [...base.map(applyOv), ...custom.map(applyOv)]
      .filter((a) => a.type !== 'hide')
      .sort((a, b) => (a.timeSec ?? Infinity) - (b.timeSec ?? Infinity));

    const actions: PipAction[] = merged.flatMap((action) => {
      const note = actionNotes[pi]?.[action.row] ?? '';
      const checkedCols = jobCols.filter((sc) => mitGrid[pi]?.[action.row]?.[sc.col] === true);
      if (checkedCols.length === 0 && !note) return [];
      const checkedSkills = checkedCols.map((sc) => pipGetSkill(sc.skill, skills, language));
      const maxDuration = checkedCols.reduce<number | null>((max, sc) => {
        if (sc.effectTime == null) return max;
        return max === null ? sc.effectTime : Math.max(max, sc.effectTime);
      }, null);
      return [{ actionName: action.name ?? '(unnamed)', timeSec: action.timeSec, duration: maxDuration, skills: checkedSkills, note, phaseIdx: pi, row: action.row }];
    });

    return { phaseName: phase.name, actions };
  });
}

// PipContent � rendered via createPortal so it lives in the main React tree

interface PipContentProps {
  jobJP: string;
  jobName: string;
  allPhases: Phase[];
  skills: Skill[];
}

export function PipContent({ jobJP, jobName, allPhases, skills }: PipContentProps) {
  const plan = useStore((s) => s.plans[s.activePlanId]);
  const mitGrid = plan?.mitGrid ?? {};
  const actionOverrides = plan?.actionOverrides ?? {};
  const customActions = plan?.customActions ?? {};
  const baseActionsCleared = plan?.baseActionsCleared ?? false;
  const actionNotesRaw = useStore((s) => s.plans[s.activePlanId]?.actionNotes);
  const actionNotes = actionNotesRaw ?? {};
  const language = useStore((s) => s.language);

  const jobIconUrl = JOB_ICON_URL[jobName] ?? null;

  const phases = useMemo(
    () => pipBuildPhases(jobJP, allPhases, skills, language, mitGrid, actionOverrides, customActions, baseActionsCleared ?? false, actionNotes),
    [jobJP, allPhases, skills, language, mitGrid, actionOverrides, customActions, baseActionsCleared, actionNotes],
  );

  const [baseElapsed, setBaseElapsed] = useState(0);
  const [runStart, setRunStart] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showNotes, setShowNotes] = useState(true);

  const running = runStart !== null;
  const elapsed = running ? baseElapsed + (now - runStart) / 1000 : baseElapsed;
  const started = elapsed > 0 || running;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [running]);

  function handleToggle() {
    if (running) { setBaseElapsed(elapsed); setRunStart(null); }
    else { setRunStart(Date.now()); }
  }
  function handleReset() { setRunStart(null); setBaseElapsed(0); setNow(Date.now()); }

  const scrollRef = React.useRef<HTMLDivElement>(null);

  const allFlat = phases.flatMap((p, pi) =>
    p.actions.map((a, ai) => ({ ...a, key: `${pi}-${ai}` }))
  );

  let currentKey: string | null = null;
  if (started) {
    for (let i = allFlat.length - 1; i >= 0; i--) {
      const t = allFlat[i].timeSec;
      if (t !== null && t <= elapsed) { currentKey = allFlat[i].key; break; }
    }
  }
  let nextKey: string | null = null;
  for (const a of allFlat) {
    const t = a.timeSec;
    if (t === null) continue;
    if (!started || t > elapsed) { nextKey = a.key; break; }
  }

  // Auto-scroll to keep the next action centered whenever it changes
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !nextKey) return;
    const el = container.querySelector<HTMLElement>(`[data-key="${nextKey}"]`);
    if (!el) return;
    const elTop = el.offsetTop;
    const elHeight = el.offsetHeight;
    const target = elTop - container.clientHeight / 2 + elHeight / 2;
    container.scrollTo({ top: target, behavior: 'smooth' });
  }, [nextKey]);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#0f1117', color: '#e2e8f0', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ background: '#181c2e', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #2d3154', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {jobIconUrl && <img src={jobIconUrl} alt={jobName} width={24} height={24} style={{ borderRadius: '4px', flexShrink: 0 }} />}
          <span style={{ fontWeight: 700, fontSize: '15px', color: '#7c9fff' }}>{jobName}</span>
        </div>
        <span style={{ fontFamily: 'monospace', fontSize: '14px', color: started ? '#86efac' : '#475569' }}>
          {pipFormatElapsed(elapsed)}
        </span>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
        {phases.map((phase, pi) => (
          <React.Fragment key={pi}>
            <div style={{ padding: '4px 14px', fontSize: '10px', fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', background: '#0d1020', borderTop: pi > 0 ? '1px solid #1e2235' : 'none', borderBottom: '1px solid #1e2235', position: 'sticky', top: 0 }}>
              {phase.phaseName}
            </div>
            {phase.actions.length === 0 && (
              <div style={{ padding: '6px 14px', fontSize: '12px', color: '#334155', fontStyle: 'italic' }}>No mitigations</div>
            )}
            {phase.actions.map((action, ai) => {
              const key = `${pi}-${ai}`;
              const isCurrent = key === currentKey;
              const isNext = key === nextKey;
              const sinceAction = isCurrent && action.timeSec !== null ? elapsed - action.timeSec : Infinity;
              const isNow = isCurrent && sinceAction < (action.duration ?? 3);
              const isPast = started && action.timeSec !== null && action.timeSec <= elapsed && !isNow;
              const countdown = started && action.timeSec !== null ? action.timeSec - elapsed : null;
              const countdownColor = countdown === null ? '#64748b'
                : countdown <= 5 ? '#f87171' : countdown <= 15 ? '#fbbf24' : '#86efac';
              return (
                <div key={ai} data-key={`${pi}-${ai}`} style={{ padding: '6px 14px 5px', background: isNow ? 'rgba(124,159,255,0.12)' : isNext ? 'rgba(134,239,172,0.06)' : 'transparent', borderLeft: isNow ? '3px solid #7c9fff' : isNext ? '3px solid #86efac' : '3px solid transparent', opacity: isPast ? 0.3 : 1, transition: 'opacity 0.3s, background 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: isNow || isNext ? 600 : 400, color: isNow ? '#e2e8f0' : isNext ? '#cbd5e1' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {action.actionName}
                    </span>
                    {isNow && (
                      <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#f87171', whiteSpace: 'nowrap', fontWeight: 700, flexShrink: 0 }}>
                        NOW{action.duration !== null && (
                          <span style={{ fontWeight: 400, color: '#475569', marginLeft: '4px' }}>
                            ({(action.duration - sinceAction).toFixed(1)}s)
                          </span>
                        )}
                      </span>
                    )}
                    {!isNow && countdown !== null && !isPast && (
                      <span style={{ fontSize: '12px', fontFamily: 'monospace', color: countdownColor, whiteSpace: 'nowrap', fontWeight: 700, flexShrink: 0 }}>
                        {pipFormatCountdown(countdown)}
                      </span>
                    )}
                    {!started && action.timeSec !== null && (
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#475569', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {`${Math.floor(Math.abs(action.timeSec) / 60)}:${Math.floor(Math.abs(action.timeSec) % 60).toString().padStart(2, '0')}`}
                      </span>
                    )}
                  </div>
                  {action.skills.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                      {action.skills.map((sk, si) => (
                        <div key={si} style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(124,159,255,0.1)', borderRadius: '4px', padding: '1px 5px 1px 2px' }}>
                          {sk.icon && <img src={sk.icon} alt={sk.name} width={16} height={16} style={{ borderRadius: '2px', flexShrink: 0 }} />}
                          <span style={{ fontSize: '11px', color: '#7c9fff', lineHeight: 1.3 }}>{sk.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {showNotes && (() => { const liveNote = actionNotes[action.phaseIdx]?.[action.row] ?? ''; return liveNote ? (
                    <div style={{ fontSize: '11px', color: '#fbbf24', marginTop: '3px', fontStyle: 'italic', lineHeight: 1.4, borderLeft: '2px solid #92400e', paddingLeft: '6px' }}>
                      {liveNote}
                    </div>
                  ) : null; })()}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid #2d3154', display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button onClick={handleToggle} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: running ? '#7f1d1d' : '#1d3a8a', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
          {running ? 'Pause' : started ? 'Resume' : 'Start'}
        </button>
        <button onClick={handleReset} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #2d3154', background: 'transparent', color: '#64748b', fontSize: '13px', cursor: 'pointer' }}>
          Reset
        </button>
        <button
          onClick={() => setShowNotes((v) => !v)}
          style={{ padding: '8px 10px', borderRadius: '6px', border: `1px solid ${showNotes ? '#92400e' : '#2d3154'}`, background: showNotes ? 'rgba(146,64,14,0.2)' : 'transparent', color: showNotes ? '#fbbf24' : '#64748b', fontSize: '13px', cursor: 'pointer' }}
          title="Toggle notes"
        >
          Notes
        </button>
      </div>
    </div>
  );
}

// Opens the PIP window and returns a handle � no React root created here.
// MitigationGrid uses createPortal to render PipContent into handle.container.

export async function openPipWindow(jobJP: string, jobName: string): Promise<PipWindowHandle | null> {
  if (!window.documentPictureInPicture) {
    alert('Document Picture-in-Picture is not supported in this browser.\nRequires Chrome 116+ or Edge 116+.');
    return null;
  }
  const win = await window.documentPictureInPicture.requestWindow({ width: 300, height: 480 });
  win.document.title = `${jobName} � Mitigations`;
  win.document.body.style.cssText = 'margin:0;padding:0;height:100vh;overflow:hidden;background:#0f1117';
  const style = win.document.createElement('style');
  style.textContent = `
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #0d1020; }
    ::-webkit-scrollbar-thumb { background: #2d3154; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #3d4270; }
    * { scrollbar-width: thin; scrollbar-color: #2d3154 #0d1020; }
  `;
  win.document.head.appendChild(style);
  const container = win.document.createElement('div');
  container.style.height = '100%';
  win.document.body.appendChild(container);
  return { win, container, jobJP, jobName };
}

// PipPortal � drop this in JSX to portal PipContent into an open PIP window.

interface PipPortalProps {
  handle: PipWindowHandle;
  allPhases: Phase[];
  skills: Skill[];
  onClose: () => void;
}

export function PipPortal({ handle, allPhases, skills, onClose }: PipPortalProps) {
  useEffect(() => {
    handle.win.addEventListener('pagehide', onClose);
    return () => handle.win.removeEventListener('pagehide', onClose);
  }, [handle, onClose]);

  return createPortal(
    <PipContent jobJP={handle.jobJP} jobName={handle.jobName} allPhases={allPhases} skills={skills} />,
    handle.container,
  );
}
