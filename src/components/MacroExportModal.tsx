import { useState, useMemo } from 'react';
import type { Phase, Skill, Action, Language } from '../types';
import type { ActionOverride } from '../store';
import { JOB_DISPLAY_NAMES } from '../store';

// FFXIV macro limits
const MAX_LINES_PER_MACRO = 15;

const CHANNELS = [
  { label: 'Echo',            cmd: '/e' },
  { label: 'Party',           cmd: '/p' },
  { label: 'Say',             cmd: '/say' },
  { label: 'Free Company',    cmd: '/fc' },
  { label: 'CWLS 1',          cmd: '/cwl1' },
  { label: 'CWLS 2',          cmd: '/cwl2' },
  { label: 'CWLS 3',          cmd: '/cwl3' },
  { label: 'CWLS 4',          cmd: '/cwl4' },
  { label: 'CWLS 5',          cmd: '/cwl5' },
  { label: 'CWLS 6',          cmd: '/cwl6' },
  { label: 'CWLS 7',          cmd: '/cwl7' },
  { label: 'CWLS 8',          cmd: '/cwl8' },
  { label: 'Linkshell 1',     cmd: '/l1' },
  { label: 'Linkshell 2',     cmd: '/l2' },
  { label: 'Linkshell 3',     cmd: '/l3' },
  { label: 'Linkshell 4',     cmd: '/l4' },
  { label: 'Linkshell 5',     cmd: '/l5' },
  { label: 'Linkshell 6',     cmd: '/l6' },
  { label: 'Linkshell 7',     cmd: '/l7' },
  { label: 'Linkshell 8',     cmd: '/l8' },
] as const;

type Channel = typeof CHANNELS[number];

interface PhaseExportData {
  phaseName: string;
  macros: string[][];  // array of macros, each macro is an array of lines
  startBeforeEngage: number; // seconds before engage to press the macro
}

function getSkillDisplayName(nameJP: string, skills: Skill[], lang: Language): string {
  const found = skills.find((s) => s.nameJP === nameJP);
  if (!found) return nameJP;
  switch (lang) {
    case 'EN': return found.nameEN || nameJP;
    case 'DE': return found.nameDE || found.nameEN || nameJP;
    case 'FR': return found.nameFR || found.nameEN || nameJP;
    case 'KO': return found.nameKO || found.nameEN || nameJP;
    case 'CN': return found.nameCN || found.nameEN || nameJP;
    default: return nameJP;
  }
}

// Default seconds before a mechanic the announcement fires (overridable in UI)
const DEFAULT_ANNOUNCE_BEFORE_SEC = 5;

// FFXIV caps <wait.X> at 60s. The content line always fires first, then chained
// /echo filler lines consume any remaining wait so timing stays accurate.
function pushWithWait(lines: string[], line: string, waitSec: number | null): void {
  const MAX = 60;
  if (waitSec == null || waitSec <= MAX) {
    lines.push(waitSec != null ? `${line} <wait.${waitSec}>` : line);
    return;
  }
  lines.push(`${line} <wait.${MAX}>`);
  let remaining = waitSec - MAX;
  while (remaining > MAX) {
    lines.push(`/echo . <wait.${MAX}>`);
    remaining -= MAX;
  }
  lines.push(`/echo . <wait.${remaining}>`);
}

function buildPhaseMacros(
  phase: Phase,
  phaseIdx: number,
  mitGrid: Record<number, Record<string, boolean>>,
  actionOverrides: Record<number, Record<number, ActionOverride>>,
  customActions: Record<number, Action[]>,
  baseActionsCleared: boolean,
  skills: Skill[],
  language: Language,
  channel: string,
  announceBefore: number,
): { macros: string[][], startBeforeEngage: number } {
  // Build merged, sorted action list (same logic as MitigationGrid)
  const baseActions = baseActionsCleared ? [] : phase.actions.filter((a) => a.name);
  const phaseCustomActions = customActions[phaseIdx] ?? [];

  const applyOverride = (a: Action): Action => {
    const ov = actionOverrides[phaseIdx]?.[a.row];
    return ov ? { ...a, ...ov } : a;
  };

  const mergedActions = [...baseActions.map(applyOverride), ...phaseCustomActions.map(applyOverride)]
    .filter((a) => a.type !== 'hide')
    .sort((a, b) => {
      const ta = a.timeSec ?? Infinity;
      const tb = b.timeSec ?? Infinity;
      return ta - tb;
    });

  // For each action, find which skill columns are checked
  const skillColMap = new Map<string, string>(); // col id → display name
  for (const sc of phase.skillCols) {
    skillColMap.set(sc.col, sc.skill);
  }

  // Only include actions at t≥0 (pre-pull countdowns are excluded — press at engage instead).
  const combatActions = mergedActions.filter((a) => a.timeSec == null || a.timeSec >= 0);

  const lines: string[] = [];

  // Initial wait = time until first announcement (mechanic.timeSec - announceBefore).
  const firstTimeSec = combatActions.find((a) => a.timeSec != null)?.timeSec ?? 0;
  const initialWait = Math.max(0, Math.round(firstTimeSec - announceBefore));
  const echoLine = `/echo Press at engage — announces ${announceBefore}s before each mechanic`;
  pushWithWait(lines, echoLine, initialWait > 0 ? initialWait : null);

  for (let i = 0; i < combatActions.length; i++) {
    const action = combatActions[i];

    // Build mitigations for this action
    const checked = mitGrid[phaseIdx]?.[action.row] ?? {};
    const byJob = new Map<string, string[]>();
    for (const [col, isChecked] of Object.entries(checked)) {
      if (!isChecked) continue;
      const skillNameJP = skillColMap.get(col);
      if (!skillNameJP) continue;

      const sc = phase.skillCols.find((s) => s.col === col);
      if (!sc) continue;

      const jobDisplay = JOB_DISPLAY_NAMES[sc.job] ?? sc.job;
      const skillDisplay = getSkillDisplayName(skillNameJP, skills, language);

      if (!byJob.has(jobDisplay)) byJob.set(jobDisplay, []);
      byJob.get(jobDisplay)!.push(skillDisplay);
    }

    const mitigationStr = byJob.size > 0
      ? ' | ' + Array.from(byJob.entries()).map(([job, sks]) => `${job}: ${sks.join(', ')}`).join(' | ')
      : '';

    const actionName = action.name ?? '(unnamed)';

    // Wait = gap between consecutive mechanic times (announceBefore cancels out).
    const next = combatActions[i + 1];
    const waitSec = (next?.timeSec != null && action.timeSec != null)
      ? Math.max(1, Math.round(next.timeSec - action.timeSec))
      : null;

    pushWithWait(lines, `${channel} ${actionName}${mitigationStr}`, waitSec);
  }

  // Split into macros of MAX_LINES_PER_MACRO lines each
  const macros: string[][] = [];
  for (let i = 0; i < lines.length; i += MAX_LINES_PER_MACRO) {
    macros.push(lines.slice(i, i + MAX_LINES_PER_MACRO));
  }
  if (macros.length === 0) macros.push([`${channel} (No actions in this phase)`]);
  return { macros, startBeforeEngage: 0 };
}

interface Props {
  phases: Phase[];
  skills: Skill[];
  language: Language;
  mitGrid: Record<number, Record<number, Record<string, boolean>>>;
  actionOverrides: Record<number, Record<number, ActionOverride>>;
  customActions: Record<number, Action[]>;
  baseActionsCleared: boolean;
  onClose: () => void;
}

export default function MacroExportModal({
  phases, skills, language, mitGrid, actionOverrides, customActions, baseActionsCleared, onClose,
}: Props) {
  const [selectedChannel, setSelectedChannel] = useState<Channel>(CHANNELS[0]);
  const [activePhaseTab, setActivePhaseTab] = useState(0);
  const [activeMacroTab, setActiveMacroTab] = useState<number[]>(() => phases.map(() => 0));
  const [copied, setCopied] = useState(false);
  const [announceBefore, setAnnounceBefore] = useState(DEFAULT_ANNOUNCE_BEFORE_SEC);

  const phaseExports = useMemo<PhaseExportData[]>(() => phases.map((phase, phaseIdx) => {
    const { macros, startBeforeEngage } = buildPhaseMacros(
      phase, phaseIdx, mitGrid[phaseIdx] ?? {}, actionOverrides, customActions,
      baseActionsCleared, skills, language, selectedChannel.cmd, announceBefore,
    );
    return { phaseName: phase.name, macros, startBeforeEngage };
  }), [phases, mitGrid, actionOverrides, customActions, baseActionsCleared, skills, language, selectedChannel, announceBefore]);

  const currentPhaseData = phaseExports[activePhaseTab];
  const currentMacroIdx = activeMacroTab[activePhaseTab] ?? 0;
  const currentMacro = currentPhaseData?.macros[currentMacroIdx] ?? [];

  function handleCopy() {
    navigator.clipboard.writeText(currentMacro.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function setMacroTab(phaseIdx: number, macroIdx: number) {
    setActiveMacroTab((prev) => {
      const next = [...prev];
      next[phaseIdx] = macroIdx;
      return next;
    });
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px',
        padding: '24px', width: '680px', maxWidth: '95vw', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text)' }}>Export Macros</div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Channel selector + announce delay */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Chat channel:</span>
            <select
              value={selectedChannel.cmd}
              onChange={(e) => {
                const ch = CHANNELS.find((c) => c.cmd === e.target.value) ?? CHANNELS[0];
                setSelectedChannel(ch);
              }}
              style={{
                background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '5px',
                color: 'var(--text)', fontSize: '13px', padding: '4px 8px', cursor: 'pointer',
              }}
            >
              {CHANNELS.map((ch) => (
                <option key={ch.cmd} value={ch.cmd}>{ch.label} ({ch.cmd})</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Announce</span>
            <input
              type="number"
              min={0}
              max={30}
              value={announceBefore}
              onChange={(e) => setAnnounceBefore(Math.max(0, Math.min(30, Number(e.target.value))))}
              style={{
                width: '52px', background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: '5px', color: 'var(--text)', fontSize: '13px', padding: '4px 6px',
              }}
            />
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>s before</span>
          </div>
        </div>

        {/* Phase tabs */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
          {phaseExports.map((p, i) => (
            <button
              key={i}
              onClick={() => setActivePhaseTab(i)}
              style={{
                padding: '4px 12px', borderRadius: '5px 5px 0 0', border: '1px solid var(--border)',
                background: activePhaseTab === i ? 'var(--accent)' : 'var(--surface2)',
                color: activePhaseTab === i ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: '12px', fontWeight: activePhaseTab === i ? 700 : 400,
              }}
            >
              {p.phaseName}
            </button>
          ))}
        </div>

        {/* Macro tabs (within phase) */}
        {currentPhaseData && currentPhaseData.macros.length > 1 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center', marginRight: '4px' }}>Macro:</span>
            {currentPhaseData.macros.map((_, mi) => (
              <button
                key={mi}
                onClick={() => setMacroTab(activePhaseTab, mi)}
                style={{
                  padding: '2px 10px', borderRadius: '4px', border: '1px solid var(--border)',
                  background: currentMacroIdx === mi ? 'var(--surface2)' : 'transparent',
                  color: currentMacroIdx === mi ? 'var(--text)' : 'var(--text-muted)',
                  cursor: 'pointer', fontSize: '12px',
                }}
              >
                #{mi + 1}
              </button>
            ))}
          </div>
        )}

        {/* Macro text */}
        <pre style={{
          background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px',
          padding: '12px', margin: 0, fontSize: '12px', fontFamily: 'monospace', color: 'var(--text)',
          overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          flex: 1, maxHeight: '340px', overflowY: 'auto',
        }}>
          {currentMacro.join('\n')}
        </pre>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {currentMacro.length}/{MAX_LINES_PER_MACRO} lines
            {currentPhaseData && currentPhaseData.macros.length > 1 && (
              <> &mdash; {currentPhaseData.macros.length} macros for this phase</>
            )}
          </span>
          <button onClick={handleCopy} style={{
            background: copied ? 'var(--heal)' : 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: '6px', padding: '7px 18px',
            fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'background 0.2s',
          }}>
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
