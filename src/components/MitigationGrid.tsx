import React, { startTransition } from 'react';
import { createPortal } from 'react-dom';
import { useStore, JOB_DISPLAY_NAMES } from '../store';
import type { Phase, Skill, Language, Action } from '../types';
import { computeMitigation, computeBarrier, computeHealBuff, formatTime, applyMitigations } from '../calc';
import EditActionModal from './EditActionModal';
import ClearAllModal from './ClearAllModal';
import MacroExportModal from './MacroExportModal';
import FFlogsImportModal from './FFlogsImportModal';
import { openPipWindow } from './pipUtils';
import type { PipWindowHandle } from './JobPipWindow';
import { JOB_ICON_URL } from '../jobIcons';
import { t, tFmt } from '../i18n';
import { getSkillLevelReq, SKILL_PREDECESSOR_JP } from '../data/skillLevels';

interface Props {
  phaseIdx: number;
  phase: Phase;
  allPhases: Phase[];
  skills: Skill[];
  onOpenPip: (handle: PipWindowHandle) => void;
  readOnlyJoin?: boolean;
}

type ColGroup = {
  job: string;
  cols: Phase['skillCols'];
  isRoleStart: boolean;
};

const ROLE_GROUPS: string[][] = [
  ['タンク', 'ナイト', '戦士', '暗黒騎士', 'ガンブレイカー'],
  ['白魔道士', '占星術師', '学者', '賢者'],
  ['モンク', '竜騎士', '忍者', '侍', 'リーパー', 'ヴァイパー'],
  ['吟遊詩人', '機工士', '踊り子'],
  ['黒魔道士', '召喚士', '赤魔道士', 'ピクトマンサー', 'キャスター', '近接'],
];
const ROLE_NAMES_KEYS = ['roleT', 'roleH', 'roleM', 'roleR', 'roleC'] as const;
const JOB_ORDER_FLAT = ROLE_GROUPS.flat();

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

function getSkillIcon(nameJP: string, skills: Skill[]): string | null {
  return skills.find((s) => s.nameJP === nameJP)?.icon ?? null;
}

const DAMAGE_TYPE_COLORS: Record<string, string> = {
  Magic: '#7b9dff',
  Physical: '#ff9966',
  hide: 'transparent',
};

const DAMAGE_TYPE_ICONS: Record<string, string> = {
  Physical: 'https://xivapi.com/i/060000/060011.png',
  Magic:    'https://xivapi.com/i/060000/060012.png',
  Unique:   'https://xivapi.com/i/060000/060013.png',
};

// Stable fallbacks so React.memo sees the same reference when a phase has no entries
const EMPTY_MIT_GRID: Record<number, Record<string, boolean>> = {};
const EMPTY_HIDDEN = new Set<number>();
const EMPTY_ACTIONS: Action[] = [];
const EMPTY_ACTION_NOTES: Record<number, string> = {};
const EMPTY_JOB_NOTES: Record<string, string> = {};
const EMPTY_JOB_NOTES_PHASE: Record<number, Record<string, string>> = {};
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = (..._args: unknown[]) => {};

// ─── Memoized table body ──────────────────────────────────────────────────────
// Kept outside MitigationGrid so that local modal-state changes in the parent
// do NOT cause this expensive subtree to reconcile.
interface TableBodyProps {
  mergedActions: Action[];
  customRowIds: Set<number>;
  allVisibleCols: Phase['skillCols'];
  mitGridForPhase: Record<number, Record<string, boolean>>;
  cellCoverage: Map<string, 'effect' | 'cooldown'>;
  hiddenSet: Set<number>;
  showHidden: boolean;
  _actionOverridesForPhase?: Record<number, import('../store').ActionOverride>;
  phaseIdx: number;
  maxHP: number;
  tankHP: number;
  roleStartCols: Set<string>;
  jobStartCols: Set<string>;
  toggleMit: (phaseIdx: number, row: number, col: string) => void;
  setEditingRow: (row: number | null) => void;
  removeCustomAction: (phaseIdx: number, row: number) => void;
  toggleHideRow: (phaseIdx: number, row: number) => void;
  insertAfterRow: (afterAction: Action | null, allVisible: Phase['skillCols']) => void;
  showNotes: boolean;
  actionNotes: Record<number, string>;
  setActionNote: (phaseIdx: number, row: number, note: string) => void;
  rowTagsForPhase: Record<number, 'tank' | 'heal' | 'dps' | 'note' | 'tb'>;
  jobNotesForPhase: Record<number, Record<string, string>>;
  visibleJobs: string[];
  setJobNote: (phaseIdx: number, row: number, jobJP: string, note: string) => void;
  viewerMode: boolean;
  allowCooldownOverride: boolean;
}

function JobNoteRow({ jobJP, note, phaseIdx, row, setJobNote }: {
  jobJP: string; note: string; phaseIdx: number; row: number;
  setJobNote: (phaseIdx: number, row: number, jobJP: string, note: string) => void;
}) {
  const [draft, setDraft] = React.useState(note);
  React.useEffect(() => { setDraft(note); }, [note]);
  const abbr = JOB_DISPLAY_NAMES[jobJP] ?? jobJP;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ minWidth: '30px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>{abbr}</span>
      <input
        type="text"
        value={draft}
        placeholder="note…"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => setJobNote(phaseIdx, row, jobJP, draft.trim())}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') { setDraft(note); (e.target as HTMLInputElement).blur(); }
        }}
        style={{
          flex: 1, height: '18px', lineHeight: '18px', padding: '0 4px',
          background: 'var(--surface2, #1e2235)', border: '1px solid var(--border, #2d3154)',
          borderRadius: '3px', color: '#67e8f9', fontSize: '11px',
          fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

function JobNotesPopover({ pos, visibleJobs, jobNotesForRow, phaseIdx, row, setJobNote, onClose }: {
  pos: { x: number; y: number }; visibleJobs: string[];
  jobNotesForRow: Record<string, string>; phaseIdx: number; row: number;
  setJobNote: (phaseIdx: number, row: number, jobJP: string, note: string) => void;
  onClose: () => void;
}) {
  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    function handleClick() { onClose(); }
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => { document.removeEventListener('keydown', handleKey); document.removeEventListener('mousedown', handleClick); };
  }, [onClose]);

  return createPortal(
    <div
      style={{
        position: 'fixed', left: pos.x, top: pos.y, zIndex: 2000,
        background: 'var(--surface, #111827)', border: '1px solid var(--border, #2d3154)',
        borderRadius: '6px', padding: '8px', minWidth: '220px',
        maxHeight: '260px', overflowY: 'auto',
        boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', gap: '4px',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: '10px', color: 'var(--text-muted, #64748b)', marginBottom: '2px', fontWeight: 600, userSelect: 'none' }}>Per-job notes</div>
      {visibleJobs.map((jobJP) => (
        <JobNoteRow
          key={jobJP} jobJP={jobJP} note={jobNotesForRow[jobJP] ?? ''}
          phaseIdx={phaseIdx} row={row} setJobNote={setJobNote}
        />
      ))}
    </div>,
    document.body,
  );
}

function NoteCell({ phaseIdx, row, note, setActionNote, jobNotesForRow, visibleJobs, setJobNote }: {
  phaseIdx: number; row: number; note: string;
  setActionNote: (p: number, r: number, n: string) => void;
  jobNotesForRow: Record<string, string>; visibleJobs: string[];
  setJobNote: (phaseIdx: number, row: number, jobJP: string, note: string) => void;
}) {
  const [draft, setDraft] = React.useState(note);
  const [showPopover, setShowPopover] = React.useState(false);
  const [popoverPos, setPopoverPos] = React.useState({ x: 0, y: 0 });
  const cellRef = React.useRef<HTMLTableCellElement>(null);
  React.useEffect(() => { setDraft(note); }, [note]);
  const jobNoteCount = visibleJobs.filter((j) => jobNotesForRow[j]).length;

  function openPopover(e: React.MouseEvent) {
    e.stopPropagation();
    const rect = cellRef.current?.getBoundingClientRect();
    if (rect) { setPopoverPos({ x: rect.left, y: rect.bottom + 2 }); setShowPopover((v) => !v); }
  }

  return (
    <td ref={cellRef} className="notes-cell" onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <input
          className="note-input"
          type="text"
          value={draft}
          placeholder="Add note…"
          style={{ flex: 1, minWidth: 0, width: 'auto' }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setActionNote(phaseIdx, row, draft.trim())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') { setDraft(note); (e.target as HTMLInputElement).blur(); }
          }}
        />
        {visibleJobs.length > 0 && (
          <button
            className={`job-note-btn${jobNoteCount > 0 ? ' job-note-btn-active' : ''}`}
            onClick={openPopover}
            title="Per-job notes"
          >
            {jobNoteCount > 0 ? jobNoteCount : 'j'}
          </button>
        )}
      </div>
      {showPopover && (
        <JobNotesPopover
          pos={popoverPos} visibleJobs={visibleJobs} jobNotesForRow={jobNotesForRow}
          phaseIdx={phaseIdx} row={row} setJobNote={setJobNote}
          onClose={() => setShowPopover(false)}
        />
      )}
    </td>
  );
}

const EMPTY_CHECKED: Record<string, boolean> = {};

// Skills listed here are always checkable even if mitStates has "-" in the data.
// Add Japanese skill names to enable them globally across all actions/phases.
const FORCE_CHECKABLE_SKILLS = new Set<string>([
  'ブラックナイト',  // The Blackest Night
  'オブレーション',  // Oblation
  'ハート・オブ・コランダム',  // Heart of Corundum
  'インターベンション',  // Intervention
]);

// Skills with phased effects that deserve extra tooltip info
const SKILL_EXTRA_TOOLTIP: Record<string, string> = {
  'ホーリーシェルトロン': '0-4s: 30% mit (Knight\'s Resolve) → 4-8s: 15% mit (Knight\'s Benediction)',
  'ハート・オブ・コランダム': '0-4s: ~28% mit (Corundum + Clarity) → 4-8s: 15% mit (Corundum only)',
};

// Single-target tank mitigation skills: only count toward mit% on TB-tagged rows
// Any skill from a tank job that targets SELF or SINGLE_PARTY is tank self-mit.
const TANK_JOBS = new Set(['タンク', 'ナイト', '戦士', '暗黒騎士', 'ガンブレイカー']);
const isTankSelfMit = (sc: { job: string; assign: string | null }) =>
  TANK_JOBS.has(sc.job) && (sc.assign === 'SELF' || sc.assign === 'SINGLE_PARTY');

// Tank invuln skills - when any of these are checked, the player survives regardless of damage.
const INVULN_SKILLS = new Set<string>([
  'インビンシブル',  // Hallowed Ground (PLD)
  'ホルムギャング',  // Holmgang (WAR)
  'リビングデッド',  // Living Dead (DRK)
  'ボライド',        // Superbolide (GNB)
]);

interface ActionRowProps {
  action: Action;
  phaseIdx: number;
  isCustom: boolean;
  checked: Record<string, boolean>;
  cellCoverage: Map<string, 'effect' | 'cooldown'>;
  isRowHidden: boolean;
  allVisibleCols: Phase['skillCols'];
  roleStartCols: Set<string>;
  jobStartCols: Set<string>;
  maxHP: number;
  tankHP: number;
  showNotes: boolean;
  note: string;
  tag: 'tank' | 'heal' | 'dps' | 'note' | 'tb' | undefined;
  fixedColCount: number;
  toggleMit: (phaseIdx: number, row: number, col: string) => void;
  setEditingRow: (row: number | null) => void;
  removeCustomAction: (phaseIdx: number, row: number) => void;
  toggleHideRow: (phaseIdx: number, row: number) => void;
  insertAfterRow: (action: Action | null, allVisible: Phase['skillCols']) => void;
  setActionNote: (phaseIdx: number, row: number, note: string) => void;
  jobNotesForRow: Record<string, string>;
  visibleJobs: string[];
  setJobNote: (phaseIdx: number, row: number, jobJP: string, note: string) => void;
  viewerMode: boolean;
  allowCooldownOverride: boolean;
}

function actionRowPropsEqual(prev: ActionRowProps, next: ActionRowProps): boolean {
  if (prev.action !== next.action) return false;
  if (prev.checked !== next.checked) return false;
  if (prev.isRowHidden !== next.isRowHidden) return false;
  if (prev.isCustom !== next.isCustom) return false;
  if (prev.allVisibleCols !== next.allVisibleCols) return false;
  if (prev.roleStartCols !== next.roleStartCols) return false;
  if (prev.jobStartCols !== next.jobStartCols) return false;
  if (prev.maxHP !== next.maxHP) return false;
  if (prev.tankHP !== next.tankHP) return false;
  if (prev.showNotes !== next.showNotes) return false;
  if (prev.note !== next.note) return false;
  if (prev.tag !== next.tag) return false;
  if (prev.fixedColCount !== next.fixedColCount) return false;
  if (prev.jobNotesForRow !== next.jobNotesForRow) return false;
  if (prev.visibleJobs !== next.visibleJobs) return false;
  if (prev.viewerMode !== next.viewerMode) return false;
  if (prev.allowCooldownOverride !== next.allowCooldownOverride) return false;
  // Only check coverage entries relevant to this specific row
  if (prev.cellCoverage !== next.cellCoverage) {
    const row = next.action.row;
    for (const sc of next.allVisibleCols) {
      const key = `${sc.col}:${row}`;
      if (prev.cellCoverage.get(key) !== next.cellCoverage.get(key)) return false;
    }
  }
  return true;
}

const ActionRow = React.memo(function ActionRow({
  action, phaseIdx, isCustom, checked, cellCoverage,
  isRowHidden, allVisibleCols, roleStartCols, jobStartCols,
  maxHP, tankHP, showNotes, note, tag, fixedColCount,
  toggleMit, setEditingRow, removeCustomAction, toggleHideRow, insertAfterRow, setActionNote,
  jobNotesForRow, visibleJobs, setJobNote, viewerMode, allowCooldownOverride,
}: ActionRowProps) {
  const colBoundaryClass = (colId: string) =>
    roleStartCols.has(colId) ? 'role-boundary' : jobStartCols.has(colId) ? 'job-boundary' : '';

  // For non-TB rows, exclude tank self-mitigation skills from calculations
  const calcCols = tag === 'tb'
    ? allVisibleCols
    : allVisibleCols.filter((sc) => !isTankSelfMit(sc));

  // Merge in skills that are "in effect" from other rows (cellCoverage === 'effect')
  const effectiveChecked = React.useMemo(() => {
    let merged: Record<string, boolean> = checked;
    for (const sc of calcCols) {
      if (merged[sc.col]) continue; // already checked on this row
      if (cellCoverage.get(`${sc.col}:${action.row}`) === 'effect') {
        if (merged === checked) merged = { ...checked }; // lazy copy
        merged[sc.col] = true;
      }
    }
    return merged;
  }, [checked, cellCoverage, calcCols, action.row]);

  const damageType = (action.type ?? 'Magic') as 'Magic' | 'Physical' | 'Unique';
  const mit = computeMitigation(action, calcCols, effectiveChecked, damageType === 'Physical' ? 'Physical' : 'Magic');
  const baseDamage = action.damageHit ?? 0;
  const mitigatedDamage = baseDamage > 0
    ? applyMitigations(baseDamage, action, calcCols, effectiveChecked, damageType)
    : 0;
  const hp = damageType === 'Physical' ? tankHP : maxHP;
  const barrier = computeBarrier(calcCols, effectiveChecked, hp, computeHealBuff(calcCols, effectiveChecked));
  const mitPct = baseDamage > 0 ? Math.round((1 - mit) * 100) : null;
  const hasInvuln = tag === 'tb' && allVisibleCols.some(sc => checked[sc.col] && INVULN_SKILLS.has(sc.skill));
  const typeColor = DAMAGE_TYPE_COLORS[action.type ?? ''] ?? '#aaa';

  return (
    <>
      <tr className={`action-row ${action.type === 'hide' ? 'hide-row' : ''} ${isRowHidden ? 'row-hidden-dim' : ''} ${isCustom ? 'custom-row' : ''} ${tag ? `tagged-row tagged-row-${tag}` : ''}`}>
        <td className="sticky-col time-cell editable-cell" onClick={() => setEditingRow(action.row)}>
          {formatTime(action.timeSec)}
        </td>
        <td className="sticky-col action-cell" onDoubleClick={() => setEditingRow(action.row)}>
          {tag && (
            <span className={`row-tag row-tag-${tag}`}>
              {{ tank: 'Tank', heal: 'Heal', dps: 'DPS', note: 'Note', tb: 'TB' }[tag]}
            </span>
          )}
          <span className="action-name">{action.name}</span>
          {!viewerMode && <button className="edit-action-btn" onClick={() => setEditingRow(action.row)} title="Edit action">✎</button>}
          {!viewerMode && (isCustom ? (
            <button
              className="hide-row-btn hide-row-btn-on"
              onClick={(e) => { e.stopPropagation(); removeCustomAction(phaseIdx, action.row); }}
              title="Delete this action"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          ) : (
            <button
              className={`hide-row-btn ${isRowHidden ? 'hide-row-btn-on' : ''}`}
              onClick={(e) => { e.stopPropagation(); toggleHideRow(phaseIdx, action.row); }}
              title={isRowHidden ? 'Unhide row' : 'Hide row'}
            >{isRowHidden ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}</button>
          ))}
        </td>
        <td className="sticky-col type-cell editable-cell" onDoubleClick={() => setEditingRow(action.row)}>
          {action.type && DAMAGE_TYPE_ICONS[action.type] ? (
            <img src={DAMAGE_TYPE_ICONS[action.type]} alt={action.type} title={action.type} width={20} height={20} style={{ display: 'block', margin: 'auto' }} />
          ) : action.type ? (
            <span className="type-badge" style={{ backgroundColor: typeColor }}>{action.type}</span>
          ) : null}
        </td>
        <td className="sticky-col dmg-cell editable-cell" onDoubleClick={() => setEditingRow(action.row)}>
          {baseDamage > 0 ? baseDamage.toLocaleString() : ''}
        </td>
        {showNotes && (
          <NoteCell
            phaseIdx={phaseIdx}
            row={action.row}
            note={note}
            setActionNote={setActionNote}
            jobNotesForRow={jobNotesForRow}
            visibleJobs={visibleJobs}
            setJobNote={setJobNote}
          />
        )}
        <td className="calc-col mit-pct-cell">
          {mitPct !== null ? (
            <span className={`mit-pct ${mitPct >= 40 ? 'high' : mitPct >= 20 ? 'med' : 'low'}`}>{mitPct}%</span>
          ) : ''}
        </td>
        <td className="calc-col mitigated-cell">
          {baseDamage > 0 ? <HPBar damage={mitigatedDamage} barrier={barrier} maxHP={hp} invuln={hasInvuln} /> : ''}
        </td>
        <td className="calc-col barrier-cell">
          {barrier > 0 ? barrier.toLocaleString() : ''}
        </td>
        {allVisibleCols.map((sc) => {
          const rawState = action.mitStates[sc.col];
          const isChecked = checked[sc.col] ?? false;

          // A skill is truly unavailable only if it has '-' AND provides no meaningful mitigation/buff value
          const hasMitValue = sc.mitPhysical != null || sc.mitMagic != null || sc.mitUnique != null
            || sc.healBuff != null || sc.barrierBuff != null || sc.barrier != null;
          if (rawState === '-' && !hasMitValue && !FORCE_CHECKABLE_SKILLS.has(sc.skill)) {
            return (
              <td key={sc.col} className={`skill-cell unavailable ${colBoundaryClass(sc.col)}`}>
                <span className="unavail-mark">-</span>
              </td>
            );
          }

          const coverage = cellCoverage.get(`${sc.col}:${action.row}`) ?? null;
          const cellBlocked = isRowHidden || coverage === 'effect' || (coverage === 'cooldown' && !allowCooldownOverride);

          return (
            <td
              key={sc.col}
              data-col={sc.col}
              className={`skill-cell ${isChecked ? 'checked' : ''} ${coverage ? `coverage-${coverage}` : ''} ${coverage === 'cooldown' && allowCooldownOverride ? 'cd-override' : ''} ${colBoundaryClass(sc.col)}`}
              title={
                isRowHidden ? 'Row is marked hidden' :
                coverage === 'cooldown' ? (allowCooldownOverride ? 'On cooldown (warning - override allowed)' : 'On cooldown') :
                coverage === 'effect' ? 'Buff active' : undefined
              }
              onClick={() => {
                if (!cellBlocked) toggleMit(phaseIdx, action.row, sc.col);
              }}
            >
              <input type="checkbox" checked={isChecked} readOnly tabIndex={-1} />
            </td>
          );
        })}
      </tr>
      {!viewerMode && (
        <tr className="insert-action-row" onClick={() => insertAfterRow(action, allVisibleCols)}>
          <td colSpan={fixedColCount + allVisibleCols.length}>
            <span className="insert-action-btn">+</span>
          </td>
        </tr>
      )}
    </>
  );
}, actionRowPropsEqual);

const MitigationTableBody = React.memo(function MitigationTableBody({
  mergedActions, customRowIds, allVisibleCols, mitGridForPhase, cellCoverage,
  hiddenSet, showHidden, phaseIdx, maxHP, tankHP,
  roleStartCols, jobStartCols, toggleMit, setEditingRow, removeCustomAction, toggleHideRow, insertAfterRow,
  showNotes, actionNotes, setActionNote, rowTagsForPhase, jobNotesForPhase, visibleJobs, setJobNote, viewerMode, allowCooldownOverride,
}: TableBodyProps) {
  const fixedColCount = 7 + (showNotes ? 1 : 0);

  return (
    <tbody>
      {!viewerMode && (
        <tr className="insert-action-row" onClick={() => insertAfterRow(null, allVisibleCols)}>
          <td colSpan={fixedColCount + allVisibleCols.length}>
            <span className="insert-action-btn">+</span>
          </td>
        </tr>
      )}
      {mergedActions.map((action) => {
        const isRowHidden = hiddenSet.has(action.row);
        if (isRowHidden && !showHidden) return null;
        return (
          <ActionRow
            key={action.row}
            action={action}
            phaseIdx={phaseIdx}
            isCustom={customRowIds.has(action.row)}
            checked={mitGridForPhase[action.row] ?? EMPTY_CHECKED}
            cellCoverage={cellCoverage}
            isRowHidden={isRowHidden}
            allVisibleCols={allVisibleCols}
            roleStartCols={roleStartCols}
            jobStartCols={jobStartCols}
            maxHP={maxHP}
            tankHP={tankHP}
            showNotes={showNotes}
            note={actionNotes[action.row] ?? ''}
            tag={rowTagsForPhase[action.row]}
            fixedColCount={fixedColCount}
            toggleMit={toggleMit}
            setEditingRow={setEditingRow}
            removeCustomAction={removeCustomAction}
            toggleHideRow={toggleHideRow}
            insertAfterRow={insertAfterRow}
            setActionNote={setActionNote}
            jobNotesForRow={jobNotesForPhase[action.row] ?? EMPTY_JOB_NOTES}
            visibleJobs={visibleJobs}
            setJobNote={setJobNote}
            viewerMode={viewerMode}
            allowCooldownOverride={allowCooldownOverride}
          />
        );
      })}
    </tbody>
  );
});

export default function MitigationGrid({ phaseIdx, phase, allPhases, skills, onOpenPip, readOnlyJoin }: Props) {
  const { language, toggleMit, initPhase, showJobs, setShowJobs, maxHP, tankHP, toggleHideRow, clearHiddenRows, encounterLevel, syncVersion, addCustomAction, removeCustomAction, clearPhase, clearPlan, clearAllPlans, clearPlanActions, setActionNote, setJobNote, viewerMode, toggleViewerMode, allowCooldownOverride, toggleAllowCooldownOverride } = useStore();
  const { mitGrid, actionOverrides, hiddenRows, customActions, name: planName, baseActionsCleared, actionNotes, rowTags, jobNotes: jobNotesRaw } = useStore((s) => s.plans[s.activePlanId]);
  const jobNotes = jobNotesRaw ?? {};

  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const hoveredColRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;
    const enter = (e: MouseEvent) => {
      const col = (e.target as Element).closest('[data-col]')?.getAttribute('data-col') ?? null;
      if (col === hoveredColRef.current) return;
      if (hoveredColRef.current) container.querySelectorAll(`[data-col="${hoveredColRef.current}"]`).forEach(el => el.classList.remove('col-hovered'));
      if (col) container.querySelectorAll(`[data-col="${col}"]`).forEach(el => el.classList.add('col-hovered'));
      hoveredColRef.current = col;
    };
    const leave = () => {
      if (hoveredColRef.current) container.querySelectorAll(`[data-col="${hoveredColRef.current}"]`).forEach(el => el.classList.remove('col-hovered'));
      hoveredColRef.current = null;
    };
    container.addEventListener('mouseover', enter);
    container.addEventListener('mouseleave', leave);
    return () => { container.removeEventListener('mouseover', enter); container.removeEventListener('mouseleave', leave); };
  }, []);

  // Re-apply col-hovered after React re-renders replace DOM nodes
  React.useLayoutEffect(() => {
    const container = tableContainerRef.current;
    const col = hoveredColRef.current;
    if (!container || !col) return;
    container.querySelectorAll(`[data-col="${col}"]`).forEach(el => {
      if (!el.classList.contains('col-hovered')) el.classList.add('col-hovered');
    });
  });

  const [showClearModal, setShowClearModal] = React.useState(false);
  const [showMacroModal, setShowMacroModal] = React.useState(false);
  const [showJobPipSelector, setShowJobPipSelector] = React.useState(false);
  const [showFFlogsModal, setShowFFlogsModal] = React.useState(false);
  const [showCDOverrideConfirm, setShowCDOverrideConfirm] = React.useState(false);
  const [cdOverrideInput, setCDOverrideInput] = React.useState('');

  const [editingRow, setEditingRow] = React.useState<number | null>(null);
  const [showHidden, setShowHidden] = React.useState(true);
  const [showTBOnly, setShowTBOnly] = React.useState(false);
  const [selectMode, setSelectMode] = React.useState(false);
  const showNotes = true;

  const hiddenSet = hiddenRows[phaseIdx] ?? EMPTY_HIDDEN;
  const hiddenCount = hiddenSet.size;

  // Init on mount and on phase change
  React.useEffect(() => {
    initPhase(phaseIdx, phase);
    setEditingRow(null);
  }, [phaseIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build a nameJP -> nameEN lookup for level-requirement checks
  const skillNameEN = React.useMemo(() => {
    const m = new Map<string, string | null>();
    for (const s of skills) m.set(s.nameJP, s.nameEN);
    return m;
  }, [skills]);

  // Filter skillCols by encounter level, and inject LB1/LB2 if LB3 is present
  const levelFilteredSkillCols = React.useMemo(() => {
    // Build nameJP -> sorted-by-level-desc Skill[] for level-appropriate stat selection
    const skillsByNameJP = new Map<string, typeof skills[0][]>();
    for (const s of skills) {
      const arr = skillsByNameJP.get(s.nameJP);
      if (arr) arr.push(s);
      else skillsByNameJP.set(s.nameJP, [s]);
    }
    for (const arr of skillsByNameJP.values()) {
      arr.sort((a, b) => b.level - a.level);
    }

    const getBestVersion = (nameJP: string) =>
      skillsByNameJP.get(nameJP)?.find((v) => v.level <= encounterLevel);

    // Apply level-appropriate stat overrides for same-nameJP skills (e.g. Reprisal 10s at lv < 98)
    const applyStatOverrides = (sc: typeof phase.skillCols[0]): typeof phase.skillCols[0] => {
      const ver = getBestVersion(sc.skill);
      if (!ver) return sc;
      return {
        ...sc,
        effectTime: ver.effectTime ?? sc.effectTime,
        recast: ver.recast ?? sc.recast,
        mitPhysical: ver.mitPhysical ?? sc.mitPhysical,
        mitMagic: ver.mitMagic ?? sc.mitMagic,
        mitUnique: ver.mitUnique ?? sc.mitUnique,
      };
    };

    // Build a replacement SkillCol from a predecessor skill (e.g. Sentinel at lv < 92 instead of Guardian)
    const buildPredecessorCol = (sc: typeof phase.skillCols[0], predNameJP: string): typeof phase.skillCols[0] | null => {
      const ver = getBestVersion(predNameJP);
      if (!ver) return null;
      return {
        col: sc.col,
        job: sc.job,
        skill: predNameJP,
        assign: ver.assign ?? sc.assign,
        charge: ver.charge,
        isAbility: ver.isAbility,
        effectTime: ver.effectTime,
        recast: ver.recast,
        mitPhysical: ver.mitPhysical,
        mitMagic: ver.mitMagic,
        mitUnique: ver.mitUnique,
        healBuffTarget: ver.healBuffTarget,
        healBuff: ver.healBuffMultiplier,
        barrierBuff: ver.barrierBuffAmount,
        barrier: ver.barrierAmount,
      };
    };

    const filtered: typeof phase.skillCols = [];
    for (const sc of phase.skillCols) {
      const nameEN = skillNameEN.get(sc.skill) ?? null;
      if (getSkillLevelReq(nameEN) <= encounterLevel) {
        filtered.push(applyStatOverrides(sc));
      } else {
        const predNameJP = SKILL_PREDECESSOR_JP[sc.skill];
        if (predNameJP) {
          const predCol = buildPredecessorCol(sc, predNameJP);
          if (predCol) filtered.push(predCol);
        }
      }
    }

    // Inject LB1 and LB2 columns alongside LB3 if they aren't already present
    const hasLB3 = filtered.some((sc) => sc.skill === 'LB3');
    const hasLB1 = filtered.some((sc) => sc.skill === 'LB1');
    const hasLB2 = filtered.some((sc) => sc.skill === 'LB2');

    if (hasLB3 && (!hasLB1 || !hasLB2)) {
      const lb3 = filtered.find((sc) => sc.skill === 'LB3')!;
      const lb3Idx = filtered.indexOf(lb3);
      const toInsert: typeof filtered = [];

      const makeLBCol = (nameJP: 'LB1' | 'LB2'): typeof filtered[0] => {
        const s = skills.find((sk) => sk.nameJP === nameJP);
        return {
          col: nameJP,
          job: lb3.job,
          skill: nameJP,
          assign: lb3.assign,
          charge: 1,
          isAbility: false,
          effectTime: s?.effectTime ?? null,
          recast: s?.recast ?? null,
          mitPhysical: s?.mitPhysical ?? null,
          mitMagic: s?.mitMagic ?? null,
          mitUnique: s?.mitUnique ?? null,
          healBuffTarget: null,
          healBuff: null,
          barrierBuff: null,
          barrier: null,
        };
      };

      if (!hasLB1) toInsert.push(makeLBCol('LB1'));
      if (!hasLB2) toInsert.push(makeLBCol('LB2'));

      return [...filtered.slice(0, lb3Idx), ...toInsert, ...filtered.slice(lb3Idx)];
    }

    return filtered;
  }, [phase.skillCols, skillNameEN, encounterLevel, skills, syncVersion]);

  // Group skill columns by job
  const colGroups = React.useMemo<ColGroup[]>(() => {
    const map = new Map<string, Phase['skillCols']>();
    for (const sc of levelFilteredSkillCols) {
      if (!map.has(sc.job)) map.set(sc.job, []);
      map.get(sc.job)!.push(sc);
    }
    const sorted = Array.from(map.entries())
      .map(([job, cols]) => ({ job, cols, isRoleStart: false }))
      .sort((a, b) => {
        const ai = JOB_ORDER_FLAT.indexOf(a.job);
        const bi = JOB_ORDER_FLAT.indexOf(b.job);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
    // Mark the first visible job in each role as a role boundary
    let lastRoleIdx = -1;
    for (const g of sorted) {
      const rIdx = ROLE_GROUPS.findIndex((r) => r.includes(g.job));
      if (rIdx !== lastRoleIdx) {
        g.isRoleStart = true;
        lastRoleIdx = rIdx;
      }
    }
    return sorted;
  }, [levelFilteredSkillCols]);

  // Filter groups by showJobs
  const visibleGroups = React.useMemo(() => {
    if (Object.keys(showJobs).length === 0) return colGroups;
    return colGroups.filter((g) => showJobs[g.job] !== false);
  }, [colGroups, showJobs]);

  const allVisibleCols = React.useMemo(
    () => visibleGroups.flatMap((g) => g.cols),
    [visibleGroups]
  );

  const visibleJobs = React.useMemo(
    () => visibleGroups.map((g) => g.job),
    [visibleGroups],
  );

  // Sets for fast boundary lookup by col id
  const roleStartCols = React.useMemo(() => {
    const s = new Set<string>();
    for (const g of visibleGroups)
      if (g.isRoleStart && g.cols.length > 0) s.add(g.cols[0].col);
    return s;
  }, [visibleGroups]);

  const jobStartCols = React.useMemo(() => {
    const s = new Set<string>();
    for (const g of visibleGroups)
      if (g.cols.length > 0) s.add(g.cols[0].col);
    return s;
  }, [visibleGroups]);

  const colBoundaryClass = (colId: string) =>
    roleStartCols.has(colId) ? 'role-boundary' : jobStartCols.has(colId) ? 'job-boundary' : '';

  // Unique real jobs across all phases (for PIP selector) - excludes role-generic pseudo-jobs
  const allJobs = React.useMemo(() => {
    const seen = new Set<string>();
    for (const p of allPhases)
      for (const sc of p.skillCols) {
        const abbr = JOB_DISPLAY_NAMES[sc.job];
        if (abbr && JOB_ICON_URL[abbr]) seen.add(sc.job);
      }
    const canonicalOrder = Object.keys(JOB_ICON_URL).map(
      (abbr) => Object.entries(JOB_DISPLAY_NAMES).find(([, v]) => v === abbr)?.[0]
    ).filter((j): j is string => !!j);
    return canonicalOrder.filter((j) => seen.has(j));
  }, [allPhases]);

  // Job crystal icons from XIVAPI, keyed by JP job name
  const jobIconMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of allPhases)
      for (const sc of p.skillCols)
        if (!map.has(sc.job)) {
          const abbr = JOB_DISPLAY_NAMES[sc.job];
          const url = abbr ? JOB_ICON_URL[abbr] : undefined;
          if (url) map.set(sc.job, url);
        }
    return map;
  }, [allPhases]);

  // Only show actions that have a name
  const actions = React.useMemo(
    () => baseActionsCleared ? [] : phase.actions.filter((a) => a.name),
    [baseActionsCleared, phase.actions],
  );

  // Custom actions for this phase (row IDs >= 1_000_000)
  const phaseCustomActions = customActions[phaseIdx] ?? EMPTY_ACTIONS;

  // Merge user overrides onto each action, then interleave custom actions sorted by time
  const mergedActions = React.useMemo<Action[]>(() => {
    const base: Action[] = actions.map((a) => {
      const ov = actionOverrides[phaseIdx]?.[a.row];
      return ov ? { ...a, ...ov } : a;
    });
    const custom: Action[] = phaseCustomActions.map((a) => {
      const ov = actionOverrides[phaseIdx]?.[a.row];
      return ov ? { ...a, ...ov } : a;
    });
    return [...base, ...custom].sort((a, b) => {
      const ta = a.timeSec ?? Infinity;
      const tb = b.timeSec ?? Infinity;
      return ta - tb;
    });
  }, [actions, phaseCustomActions, actionOverrides, phaseIdx]);

  // Set of custom row IDs for UI differentiation
  const customRowIds = React.useMemo(
    () => new Set(phaseCustomActions.map((a) => a.row)),
    [phaseCustomActions]
  );

  const handleAddAction = () => {
    const row = Date.now();
    const newAction: Action = {
      row,
      timeSec: null,
      name: 'New Action',
      type: 'Magic',
      damageHit: null,
      damageDot: null,
      damageTick: null,
      mitStates: {},
    };
    addCustomAction(phaseIdx, newAction);
    setEditingRow(row);
  };

  const handleInsertAfterRow = React.useCallback((afterAction: Action | null, allVisible: Phase['skillCols']) => {
    const row = Date.now();
    // Compute a timeSec between afterAction and the next action
    let timeSec: number | null = null;
    if (afterAction !== null) {
      const afterTime = afterAction.timeSec;
      const afterIdx = mergedActions.findIndex((a) => a.row === afterAction.row);
      const nextAction = afterIdx >= 0 ? mergedActions[afterIdx + 1] : null;
      const nextTime = nextAction?.timeSec ?? null;
      if (afterTime !== null && nextTime !== null) {
        timeSec = Math.round(((afterTime + nextTime) / 2) * 10) / 10;
      } else if (afterTime !== null) {
        timeSec = afterTime + 1;
      }
    } else {
      // Before first row
      const firstTime = mergedActions[0]?.timeSec ?? null;
      if (firstTime !== null && firstTime > 1) timeSec = Math.round((firstTime / 2) * 10) / 10;
      else timeSec = 0;
    }
    // Mark single-target cells as unavailable only if the skill provides no mitigation/barrier/buff
    // (i.e. pure spot heals). Skills like Feint, Addle, Dismantle, Minne provide meaningful
    // mitigation or buffs and should remain checkable on custom rows.
    const mitStates: Record<string, boolean | string | number> = {};
    for (const sc of allVisible) {
      if (sc.assign === 'SINGLE_PARTY' || sc.assign === 'SINGLE_ENEMY') {
        const hasMitValue = sc.mitPhysical != null || sc.mitMagic != null || sc.mitUnique != null
          || sc.healBuff != null || sc.barrierBuff != null || sc.barrier != null;
        if (!hasMitValue) mitStates[sc.col] = '-';
      }
    }
    const newAction: Action = { row, timeSec, name: 'New Action', type: 'Magic', damageHit: null, damageDot: null, damageTick: null, mitStates };
    addCustomAction(phaseIdx, newAction);
    setEditingRow(row);
  }, [mergedActions, addCustomAction, phaseIdx]);

  const editingAction = editingRow !== null
    ? (actions.find((a) => a.row === editingRow) ?? phaseCustomActions.find((a) => a.row === editingRow) ?? null)
    : null;
  const editingDisplay = editingRow !== null ? mergedActions.find((a) => a.row === editingRow) ?? null : null;

  // Compute cooldown / effect coverage: Map<`col:row`, 'effect' | 'cooldown'>
  const cellCoverage = React.useMemo(() => {
    const map = new Map<string, 'effect' | 'cooldown'>();

    // Binary search helpers
    // lowerBound: first index where arr[i] >= value
    function lowerBound(arr: number[], value: number): number {
      let lo = 0, hi = arr.length;
      while (lo < hi) { const mid = (lo + hi) >>> 1; if (arr[mid] < value) lo = mid + 1; else hi = mid; }
      return lo;
    }
    // upperBound: first index where arr[i] > value
    function upperBound(arr: number[], value: number): number {
      let lo = 0, hi = arr.length;
      while (lo < hi) { const mid = (lo + hi) >>> 1; if (arr[mid] <= value) lo = mid + 1; else hi = mid; }
      return lo;
    }

    for (const sc of allVisibleCols) {
      const recast = sc.recast ?? 0;
      const effectTime = sc.effectTime ?? 0;
      if (recast === 0 && effectTime === 0) continue;

      // Sorted source times for this col (O(n log n) once per col)
      const sourceTimes = mergedActions
        .filter((a) => (mitGrid[phaseIdx]?.[a.row]?.[sc.col] === true) && a.timeSec != null)
        .map((a) => a.timeSec as number)
        .sort((a, b) => a - b);
      if (sourceTimes.length === 0) continue;

      const maxCharges = Math.max(1, sc.charge ?? 1);

      const hasMitValueForCov = sc.mitPhysical != null || sc.mitMagic != null || sc.mitUnique != null
        || sc.healBuff != null || sc.barrierBuff != null || sc.barrier != null;

      for (const target of mergedActions) {
        const T = target.timeSec;
        if (T == null) continue;
        if (mitGrid[phaseIdx]?.[target.row]?.[sc.col] === true) continue;
        if (target.mitStates[sc.col] === '-' && !hasMitValueForCov && !FORCE_CHECKABLE_SKILLS.has(sc.skill)) continue;

        // inEffect: source s where s <= T && s >= T - effectTime  ->  s ∈ [T-effectTime, T]
        const inEffect =
          effectTime > 0 &&
          lowerBound(sourceTimes, T - effectTime) < upperBound(sourceTimes, T);

        // onCooldown: source s where s < T && s > T - recast  ->  s ∈ (T-recast, T)
        const chargesOnCooldown =
          recast > 0
            ? lowerBound(sourceTimes, T) - upperBound(sourceTimes, T - recast)
            : 0;
        const onCooldown = chargesOnCooldown >= maxCharges;

        if (inEffect) {
          map.set(`${sc.col}:${target.row}`, 'effect');
        } else if (onCooldown) {
          map.set(`${sc.col}:${target.row}`, 'cooldown');
        }
      }
    }
    return map;
  }, [allVisibleCols, mergedActions, mitGrid, phaseIdx]);

  // Use user-set rowTags for this phase
  const rowTagsForPhase = React.useMemo(() => {
    return (rowTags ?? {})[phaseIdx] ?? {};
  }, [rowTags, phaseIdx]);

  const actionNotesForPhase = (actionNotes ?? {})[phaseIdx] ?? EMPTY_ACTION_NOTES;

  // When TB-only filter is active, show only tb-tagged rows (handled inside MitigationTableBody
  // to keep all rows mounted and avoid unmount/remount cost on toggle)

  return (
    <div className="mit-grid-wrap">
      {editingAction && editingDisplay && (
        <EditActionModal
          phaseIdx={phaseIdx}
          action={editingAction}
          displayAction={editingDisplay}
          onClose={() => setEditingRow(null)}
        />
      )}
      {/* Job filter toggles */}
      <div className="job-toggles">
        <button
          className={`role-toggle ${selectMode ? 'select-active' : 'select-inactive'}`}
          title={selectMode ? 'Solo mode: click a job to show only that job (click again to restore all)' : 'Enable solo mode: click to select one job at a time'}
          onClick={() => setSelectMode((m) => !m)}
        >
          Solo
        </button>
        <button
          className={`role-toggle ${showTBOnly ? 'select-active' : 'select-inactive'}`}
          title={showTBOnly ? 'Showing tankbusters only — click to show all rows' : 'Filter to tankbuster rows only'}
          onClick={() => setShowTBOnly((v) => !v)}
        >
          TB
        </button>
        <span className="role-divider" />
        {(() => {
          // Group colGroups by role index
          const roleIdx = (job: string) => ROLE_GROUPS.findIndex((r) => r.includes(job));
          let lastRole = -1;
          return colGroups.map((g) => {
            const ri = roleIdx(g.job);
            const isNewRole = ri !== lastRole;
            if (isNewRole) lastRole = ri;

            // Role toggle button shown at the start of each role
            const roleButton = isNewRole ? (() => {
              const roleJobs = colGroups.filter((x) => roleIdx(x.job) === ri).map((x) => x.job);
              const allOff = roleJobs.every((j) => showJobs[j] === false);
              const anyOff = roleJobs.some((j) => showJobs[j] === false);
              const handleRoleToggle = () => {
                const next = { ...showJobs };
                if (allOff || anyOff) {
                  // Turn all on
                  roleJobs.forEach((j) => delete next[j]);
                } else {
                  // Turn all off
                  roleJobs.forEach((j) => { next[j] = false; });
                }
                setShowJobs(next);
              };
              return (
                <button
                  key={`role-${ri}`}
                  className={`role-toggle ${allOff ? 'role-off' : anyOff ? 'role-partial' : 'role-on'}`}
                  onClick={handleRoleToggle}
                  title={allOff || anyOff ? `Show all ${t(ROLE_NAMES_KEYS[ri], language)}` : `Hide all ${t(ROLE_NAMES_KEYS[ri], language)}`}
                >
                  {t(ROLE_NAMES_KEYS[ri], language) ?? `Role ${ri}`}
                </button>
              );
            })() : null;

            return (
              <React.Fragment key={g.job}>
                {roleButton}
                <button
                  className={`job-toggle ${showJobs[g.job] === false ? 'job-off' : 'visible'}`}
                  onClick={() => startTransition(() => {
                    if (selectMode) {
                      const allColJobs = colGroups.map((x) => x.job);
                      const onlyThis = allColJobs.every((j) => j === g.job || showJobs[j] === false);
                      if (onlyThis) {
                        setShowJobs({});
                      } else {
                        const next: Record<string, boolean> = {};
                        allColJobs.forEach((j) => { if (j !== g.job) next[j] = false; });
                        setShowJobs(next);
                      }
                    } else {
                      useStore.getState().toggleJob(g.job);
                    }
                  })}
                >
                  {JOB_DISPLAY_NAMES[g.job] ?? g.job}
                </button>
              </React.Fragment>
            );
          });
        })()}
        {hiddenCount > 0 && (
          <>
            <span className="role-divider" />
            {showHidden ? (
              // Rows are dimmed but visible - offer to collapse them
              <>
                <button
                  className="job-toggle visible"
                  onClick={() => setShowHidden(false)}
                  title={`Remove ${hiddenCount} marked row${hiddenCount > 1 ? 's' : ''} from view`}
                >
                  {t('colAction', language)} {hiddenCount}
                </button>
                <button
                  className="job-toggle job-off"
                  onClick={() => { clearHiddenRows(phaseIdx); }}
                  title="Unmark all rows"
                >
                  Unmark all
                </button>
              </>
            ) : (
              // Rows are collapsed - offer to show them dimmed again
              <button
                className="job-toggle job-off"
                onClick={() => setShowHidden(true)}
                title={`Show ${hiddenCount} hidden row${hiddenCount > 1 ? 's' : ''} (dimmed)`}
              >
                {tFmt('hiddenRows', language, { n: hiddenCount })}
              </button>
            )}
          </>
        )}
        <span className="role-divider" />
      </div>

      <div className="mit-toolbar">
        {!viewerMode && (
          <button className="add-action-btn" onClick={handleAddAction} title={t('btnAddAction', language)}>
            {t('btnAddAction', language)}
          </button>
        )}
        {!viewerMode && (
          <button
            className="add-action-btn"
            style={{ color: '#a78bfa', borderColor: '#4c1d95' }}
            onClick={() => setShowMacroModal(true)}
            title="Export macros"
          >
            Export macros
          </button>
        )}
        {!viewerMode && (
          <button
            className="add-action-btn"
            style={{ color: '#fbbf24', borderColor: '#713f12' }}
            onClick={() => setShowFFlogsModal(true)}
            title="Import from FFLogs"
          >
            FFLogs
          </button>
        )}
        <button
          className="add-action-btn"
          style={{ color: '#67e8f9', borderColor: '#164e63' }}
          onClick={() => setShowJobPipSelector(true)}
          title="Open Cheat Sheet"
        >
          Cheat Sheet
        </button>

        {/* {!viewerMode && baseActionsCleared && (
          <button
            className="add-action-btn"
            style={{ color: '#86efac', borderColor: '#14532d' }}
            onClick={() => restoreBaseActions()}
            title="Restore encounter data"
          >
            Restore encounter data
          </button>
        )} */}
        {!viewerMode && (
          <button className="add-action-btn" style={{ color: '#f87171', borderColor: '#7f1d1d' }} onClick={() => setShowClearModal(true)} title={t('btnClear', language)}>
            {t('btnClear', language)}
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button
          className="add-action-btn"
          style={allowCooldownOverride
            ? { color: '#fb923c', borderColor: '#7c2d12', background: 'rgba(251,146,60,0.1)' }
            : { color: 'var(--text-muted)', borderColor: 'var(--border)' }}
          onClick={() => {
            if (!allowCooldownOverride) {
              setCDOverrideInput('');
              setShowCDOverrideConfirm(true);
            } else {
              toggleAllowCooldownOverride();
            }
          }}
          title={allowCooldownOverride
            ? 'CD conflicts allowed (click to block)'
            : 'CD conflicts blocked (click to allow)'}
        >
          {allowCooldownOverride ? '⚠ CD Override' : '⚠'}
        </button>
        <button
          className={`add-action-btn${viewerMode ? ' viewer-mode-active' : ''}`}
          style={viewerMode
            ? { color: '#fbbf24', borderColor: '#92400e', background: 'rgba(251,191,36,0.15)', fontWeight: 700 }
            : { color: 'var(--text-muted)', borderColor: 'var(--border)' }}
          onClick={toggleViewerMode}
          title={readOnlyJoin ? 'Read-only session — rejoin with the full share link to edit' : viewerMode ? 'Exit viewer mode' : 'Enter viewer mode (notes only)'}
        >
          {viewerMode ? '👁 Viewing - click to edit' : '👁'}
        </button>
      </div>

      {viewerMode && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '5px 14px',
          background: 'rgba(146,64,14,0.18)',
          borderBottom: '1px solid #92400e',
          fontSize: '12px', color: '#fbbf24', fontWeight: 600,
          userSelect: 'none',
        }}>
          <span>👁 Viewer mode - checkboxes and edits are disabled.</span>
          {!readOnlyJoin && (
            <button
              onClick={toggleViewerMode}
              style={{
                marginLeft: 'auto', padding: '2px 10px', borderRadius: 4,
                border: '1px solid #92400e', background: 'transparent',
                color: '#fbbf24', cursor: 'pointer', fontSize: '11px', fontWeight: 700,
              }}
            >
              Switch to Edit
            </button>
          )}
          {readOnlyJoin && (
            <span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.6 }}>Read-only — no write token</span>
          )}
        </div>
      )}

      {showClearModal && (
        <ClearAllModal
          phaseName={phase.name}
          planName={planName}
          onClearPhase={() => { clearPhase(phaseIdx); setShowClearModal(false); }}
          onClearPlan={() => { clearPlan(); setShowClearModal(false); }}
          onClearAll={() => { clearAllPlans(); setShowClearModal(false); }}
          onClearActions={() => { clearPlanActions(); setShowClearModal(false); }}
          onCancel={() => setShowClearModal(false)}
        />
      )}

      {showMacroModal && (
        <MacroExportModal
          phases={allPhases}
          skills={skills}
          language={language}
          mitGrid={mitGrid}
          actionOverrides={actionOverrides}
          customActions={customActions}
          baseActionsCleared={baseActionsCleared ?? false}
          onClose={() => setShowMacroModal(false)}
        />
      )}

      {showFFlogsModal && (
        <FFlogsImportModal
          allPhases={allPhases}
          skills={skills}
          onClose={() => setShowFFlogsModal(false)}
        />
      )}

      {showCDOverrideConfirm && (
        <div className="encounter-dialog-overlay" onClick={() => setShowCDOverrideConfirm(false)}>
          <div className="encounter-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h2 className="encounter-dialog-title" style={{ color: '#fb923c' }}>⚠ Enable CD Override?</h2>
            <p style={{ margin: '0 0 16px', color: 'var(--text-dim, #9ca3af)', fontSize: 13, lineHeight: 1.5 }}>
              Allows skills to be checked even when their cooldown hasn't resolved. Cooldown cells will stay highlighted as a reminder, but won't block input.
              {' '}<strong style={{ color: '#fca5a5' }}>Only use this if you know the cooldown tracking is wrong for your situation.</strong>
            </p>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text)' }}>
              Type <strong style={{ color: '#fb923c' }}>confirm</strong> to proceed:
            </p>
            <input
              type="text"
              value={cdOverrideInput}
              onChange={(e) => setCDOverrideInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && cdOverrideInput === 'confirm') {
                  toggleAllowCooldownOverride();
                  setShowCDOverrideConfirm(false);
                } else if (e.key === 'Escape') {
                  setShowCDOverrideConfirm(false);
                }
              }}
              placeholder="confirm"
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 10px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--surface2, #1e2235)',
                color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                outline: 'none', marginBottom: 16,
              }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCDOverrideConfirm(false)}
                style={{
                  padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                disabled={cdOverrideInput !== 'confirm'}
                onClick={() => {
                  toggleAllowCooldownOverride();
                  setShowCDOverrideConfirm(false);
                }}
                style={{
                  padding: '7px 16px', borderRadius: 6, border: '1px solid #7c2d12',
                  background: cdOverrideInput === 'confirm' ? 'rgba(251,146,60,0.15)' : 'transparent',
                  color: cdOverrideInput === 'confirm' ? '#fb923c' : 'var(--text-muted)',
                  cursor: cdOverrideInput === 'confirm' ? 'pointer' : 'not-allowed',
                  fontSize: 13, fontWeight: 600,
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showJobPipSelector && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px',
            padding: '24px', minWidth: '320px', maxWidth: '90vw',
            display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>Select job for PIP</div>
              <button onClick={() => setShowJobPipSelector(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Opens a floating window showing when to use mitigations for the selected job.
            </div>
            {!window.documentPictureInPicture && (
              <div style={{
                fontSize: '12px', color: '#fbbf24',
                background: 'rgba(146,64,14,0.2)', border: '1px solid #92400e',
                borderRadius: '6px', padding: '8px 10px',
                display: 'flex', alignItems: 'flex-start', gap: '6px',
              }}>
                <span style={{ flexShrink: 0 }}>⚠️</span>
                <span>
                  Your browser does not support Document Picture-in-Picture. A regular popup window will open instead - it won't stay on top automatically.
                  For the best experience, use Chrome or Edge 116+.
                </span>
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {allJobs.map((jobJP) => {
                const abbr = JOB_DISPLAY_NAMES[jobJP] ?? jobJP;
                const iconUrl = jobIconMap.get(jobJP);
                return (
                  <button
                    key={jobJP}
                    title={abbr}
                    onClick={() => {
                      setShowJobPipSelector(false);
                      openPipWindow(jobJP, abbr).then((h) => { if (h) onOpenPip(h); });
                    }}
                    style={{
                      width: '44px', height: '44px', borderRadius: '8px',
                      border: '1px solid var(--border)', background: 'var(--surface2)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0, overflow: 'hidden',
                    }}
                  >
                    {iconUrl
                      ? <img src={iconUrl} alt={abbr} width={40} height={40} style={{ display: 'block', imageRendering: 'auto' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.parentElement!).textContent = abbr; }} />
                      : <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text)' }}>{abbr}</span>
                    }
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className={`mit-table-container${showTBOnly ? ' tb-filter-active' : ''}`} ref={tableContainerRef}>
        <table className="mit-table">
          <colgroup>
            <col style={{ width: '46px' }} />
            <col style={{ width: '160px' }} />
            <col style={{ width: '28px' }} />
            <col style={{ width: '68px' }} />
            {showNotes && <col style={{ width: '160px' }} />}
            <col style={{ width: '60px' }} />
            <col style={{ width: '60px' }} />
            <col style={{ width: '60px' }} />
            {allVisibleCols.map((sc) => (
              <col key={sc.col} style={{ width: '36px' }} />
            ))}
          </colgroup>
          <thead>
            {/* Job row */}
            <tr className="job-header-row">
              <th className="sticky-col time-col">{t('colTime', language)}</th>
              <th className="sticky-col action-col">{t('colAction', language)}</th>
              <th className="sticky-col type-col">{t('colType', language)}</th>
              <th className="sticky-col dmg-col">{t('colDamage', language)}</th>
              {showNotes && <th className="notes-col">Notes</th>}
              <th className="calc-col">{t('colMitPct', language)}</th>
              <th className="calc-col">{t('colMitigated', language)}</th>
              <th className="calc-col">{t('colBarrier', language)}</th>
              {visibleGroups.map((g) => (
                <th
                  key={g.job}
                  colSpan={g.cols.length}
                  className={`job-group-header job-${(JOB_DISPLAY_NAMES[g.job] ?? g.job).toLowerCase()} ${g.isRoleStart ? 'role-boundary' : 'job-boundary'}`}
                >
                  {JOB_DISPLAY_NAMES[g.job] ?? g.job}
                </th>
              ))}
            </tr>
            {/* Skill name row */}
            <tr className="skill-header-row">
              <th className="sticky-col" />
              <th className="sticky-col" />
              <th className="sticky-col" />
              <th className="sticky-col" />
              {showNotes && <th className="notes-col" />}
              <th className="calc-col" />
              <th className="calc-col" />
              <th className="calc-col" />
              {allVisibleCols.map((sc) => {
                const icon = getSkillIcon(sc.skill, skills);
                const name = getSkillDisplayName(sc.skill, skills, language);
                const extraTip = SKILL_EXTRA_TOOLTIP[sc.skill];
                const titleText = extraTip ? `${name}\n${extraTip}` : name;
                return (
                  <th key={sc.col} data-col={sc.col} className={`skill-col-header ${colBoundaryClass(sc.col)}`} title={titleText}>
                    {icon ? (
                      <span className="icon-wrap">
                        <img src={icon} alt={name} width={20} height={20} loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        {/^LB[123]$/.test(sc.skill) && (
                          <span className="lb-num-badge">{sc.skill.slice(2)}</span>
                        )}
                      </span>
                    ) : (
                      <span className="skill-short">{name.substring(0, 4)}</span>
                    )}
                    {sc.barrier ? <span className="skill-badge barrier-badge" title={`Barrier: ${sc.barrier}×HP/1000`}>🛡</span> : null}
                    {sc.barrierBuff ? <span className="skill-badge barrierbuff-badge" title={`+${Math.round(sc.barrierBuff*100)}% barrier`}>+</span> : null}
                  </th>
                );
              })}
            </tr>
            {/* Recast / effect time row */}
            <tr className="skill-info-row">
              <th className="sticky-col" />
              <th className="sticky-col" />
              <th className="sticky-col" />
              <th className="sticky-col" />
              {showNotes && <th className="notes-col" />}
              <th className="calc-col" />
              <th className="calc-col" />
              <th className="calc-col" />
              {allVisibleCols.map((sc) => {
                const extraTip = SKILL_EXTRA_TOOLTIP[sc.skill];
                return (
                <th key={sc.col} data-col={sc.col} className={`skill-recast-header ${colBoundaryClass(sc.col)}`} title={extraTip || undefined}>
                  {sc.effectTime != null ? `${sc.effectTime}s` : ''}
                </th>
                );
              })}
            </tr>
          </thead>
          <MitigationTableBody
            mergedActions={mergedActions}
            customRowIds={customRowIds}
            allVisibleCols={allVisibleCols}
            mitGridForPhase={mitGrid[phaseIdx] ?? EMPTY_MIT_GRID}
            cellCoverage={cellCoverage}
            hiddenSet={hiddenSet}
            showHidden={showHidden}
            phaseIdx={phaseIdx}
            maxHP={maxHP}
            tankHP={tankHP}
            roleStartCols={roleStartCols}
            jobStartCols={jobStartCols}
            toggleMit={viewerMode ? noop : toggleMit}
            setEditingRow={viewerMode ? noop : setEditingRow}
            removeCustomAction={viewerMode ? noop : removeCustomAction}
            toggleHideRow={viewerMode ? noop : toggleHideRow}
            insertAfterRow={viewerMode ? noop : handleInsertAfterRow}
            showNotes={showNotes}
            actionNotes={actionNotesForPhase}
            setActionNote={setActionNote}
            rowTagsForPhase={rowTagsForPhase}
            jobNotesForPhase={jobNotes[phaseIdx] ?? EMPTY_JOB_NOTES_PHASE}
            visibleJobs={visibleJobs}
            setJobNote={setJobNote}
            viewerMode={viewerMode}
            allowCooldownOverride={allowCooldownOverride}
          />
        </table>
      </div>
    </div>
  );
}

function HPBar({ damage, barrier, maxHP, invuln }: { damage: number; barrier: number; maxHP: number; invuln?: boolean }) {
  const remaining = maxHP - damage;
  const remainingPct = Math.max(0, Math.min(100, (remaining / maxHP) * 100));
  const barrierPct = Math.min(100 - remainingPct, (barrier / maxHP) * 100);
  const damagePct = 100 - remainingPct - barrierPct;

  const survived = invuln || damage <= maxHP + barrier;

  return (
    <div className="hp-bar-wrap" title={`${damage.toLocaleString()} damage, ${barrier.toLocaleString()} barrier, ${remaining.toLocaleString()} remaining`}>
      <div className="hp-bar">
        <div className="hp-life" style={{ width: `${remainingPct}%` }} />
        <div className="hp-barrier" style={{ width: `${barrierPct}%` }} />
        <div className="hp-damage" style={{ width: `${Math.min(damagePct, 100)}%` }} />
      </div>
      <span className={`hp-label ${survived ? '' : 'lethal'} ${invuln ? 'invuln' : ''}`}>
        {invuln ? 'Invuln' : survived ? `${remaining.toLocaleString()}` : 'LETHAL'}
      </span>
    </div>
  );
}
