import React from 'react';
import { useStore, JOB_DISPLAY_NAMES } from '../store';
import type { Phase, Skill, Language, Action } from '../types';
import { computeMitigation, computeBarrier, computeHealBuff, formatTime } from '../calc';
import EditActionModal from './EditActionModal';
import { getSkillLevelReq } from '../data/skillLevels';

interface Props {
  phaseIdx: number;
  phase: Phase;
  skills: Skill[];
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

export default function MitigationGrid({ phaseIdx, phase, skills }: Props) {
  const { language, mitGrid, toggleMit, initPhase, showJobs, maxHP, tankHP, actionOverrides, hiddenRows, toggleHideRow, clearHiddenRows, encounterLevel } = useStore();

  const [editingRow, setEditingRow] = React.useState<number | null>(null);
  const [showHidden, setShowHidden] = React.useState(true);

  const hiddenSet = hiddenRows[phaseIdx] ?? new Set<number>();
  const hiddenCount = hiddenSet.size;

  // Init on mount
  React.useEffect(() => {
    initPhase(phaseIdx, phase);
  }, [phaseIdx, phase]);

  const checkedForAction = React.useCallback(
    (row: number): Record<string, boolean> => {
      return mitGrid[phaseIdx]?.[row] ?? {};
    },
    [mitGrid, phaseIdx]
  );

  // Build a nameJP → nameEN lookup for level-requirement checks
  const skillNameEN = React.useMemo(() => {
    const m = new Map<string, string | null>();
    for (const s of skills) m.set(s.nameJP, s.nameEN);
    return m;
  }, [skills]);

  // Filter skillCols by encounter level
  const levelFilteredSkillCols = React.useMemo(
    () => phase.skillCols.filter((sc) => {
      const nameEN = skillNameEN.get(sc.skill) ?? null;
      return getSkillLevelReq(nameEN) <= encounterLevel;
    }),
    [phase.skillCols, skillNameEN, encounterLevel]
  );

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

  // Only show actions that have a name
  const actions = phase.actions.filter((a) => a.name);

  // Merge user overrides onto each action
  const mergedActions = React.useMemo<Action[]>(
    () => actions.map((a) => {
      const ov = actionOverrides[phaseIdx]?.[a.row];
      return ov ? { ...a, ...ov } : a;
    }),
    [actions, actionOverrides, phaseIdx]
  );

  const editingAction = editingRow !== null ? actions.find((a) => a.row === editingRow) ?? null : null;
  const editingDisplay = editingRow !== null ? mergedActions.find((a) => a.row === editingRow) ?? null : null;

  // Compute cooldown / effect coverage: Map<`col:row`, 'effect' | 'cooldown'>
  const cellCoverage = React.useMemo(() => {
    const map = new Map<string, 'effect' | 'cooldown'>();

    for (const sc of allVisibleCols) {
      const recast = sc.recast ?? 0;
      const effectTime = sc.effectTime ?? 0;
      if (recast === 0 && effectTime === 0) continue;

      // Actions where this col is actively checked, sorted by time
      const sources = mergedActions
        .filter((a) => (mitGrid[phaseIdx]?.[a.row]?.[sc.col] === true) && a.timeSec != null)
        .sort((a, b) => (a.timeSec as number) - (b.timeSec as number));
      if (sources.length === 0) continue;

      const maxCharges = Math.max(1, sc.charge ?? 1);

      for (const target of mergedActions) {
        const T = target.timeSec;
        if (T == null) continue;
        // Source rows handle their own display
        if (mitGrid[phaseIdx]?.[target.row]?.[sc.col] === true) continue;
        // Already marked '-' in the spreadsheet — don't override
        if (target.mitStates[sc.col] === '-') continue;

        // Is this row within any source's effect window?
        const inEffect =
          effectTime > 0 &&
          sources.some((s) => s.timeSec != null && T > s.timeSec && T <= s.timeSec + effectTime);

        // How many charges are still on cooldown at time T?
        const chargesOnCooldown =
          recast > 0
            ? sources.filter((s) => s.timeSec != null && s.timeSec < T && T < s.timeSec + recast).length
            : 0;
        const onCooldown = chargesOnCooldown >= maxCharges;

        // Effect window takes priority over cooldown (buff is active = more informative)
        if (inEffect) {
          map.set(`${sc.col}:${target.row}`, 'effect');
        } else if (onCooldown) {
          map.set(`${sc.col}:${target.row}`, 'cooldown');
        }
      }
    }
    return map;
  }, [allVisibleCols, mergedActions, mitGrid, phaseIdx]);

  const getCoverage = (col: string, row: number) =>
    cellCoverage.get(`${col}:${row}`) ?? null;

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
        {colGroups.map((g) => (
          <React.Fragment key={g.job}>
            {g.isRoleStart && colGroups.indexOf(g) !== 0 && (
              <span className="role-divider" />
            )}
            <button
              className={`job-toggle ${showJobs[g.job] === false ? 'job-off' : 'visible'}`}
              onClick={() => useStore.getState().toggleJob(g.job)}
            >
              {JOB_DISPLAY_NAMES[g.job] ?? g.job}
            </button>
          </React.Fragment>
        ))}
        {hiddenCount > 0 && (
          <>
            <span className="role-divider" />
            {showHidden ? (
              // Rows are dimmed but visible — offer to collapse them
              <>
                <button
                  className="job-toggle visible"
                  onClick={() => setShowHidden(false)}
                  title={`Remove ${hiddenCount} marked row${hiddenCount > 1 ? 's' : ''} from view`}
                >
                  Hide {hiddenCount} marked
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
              // Rows are collapsed — offer to show them dimmed again
              <button
                className="job-toggle job-off"
                onClick={() => setShowHidden(true)}
                title={`Show ${hiddenCount} hidden row${hiddenCount > 1 ? 's' : ''} (dimmed)`}
              >
                {hiddenCount} hidden
              </button>
            )}
          </>
        )}
      </div>

      <div className="mit-table-container">
        <table className="mit-table">
          <thead>
            {/* Job row */}
            <tr className="job-header-row">
              <th className="sticky-col time-col">Time</th>
              <th className="sticky-col action-col">Action</th>
              <th className="sticky-col type-col">Type</th>
              <th className="sticky-col dmg-col">Damage</th>
              <th className="calc-col">Mit%</th>
              <th className="calc-col">Mitigated</th>
              <th className="calc-col">Barrier</th>
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
              <th className="calc-col" />
              <th className="calc-col" />
              <th className="calc-col" />
              {allVisibleCols.map((sc) => {
                const icon = getSkillIcon(sc.skill, skills);
                const name = getSkillDisplayName(sc.skill, skills, language);
                return (
                  <th key={sc.col} className={`skill-col-header ${colBoundaryClass(sc.col)}`} title={name}>
                    {icon ? (
                      <img src={icon} alt={name} width={24} height={24} loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
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
              <th className="calc-col" />
              <th className="calc-col" />
              <th className="calc-col" />
              {allVisibleCols.map((sc) => (
                <th key={sc.col} className={`skill-recast-header ${colBoundaryClass(sc.col)}`}>
                  {sc.effectTime != null ? `${sc.effectTime}s` : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mergedActions.map((action) => {
              const isRowHidden = hiddenSet.has(action.row);
              if (isRowHidden && !showHidden) return null;

              const original = actions.find((a) => a.row === action.row)!;;
              const isOverridden = !!actionOverrides[phaseIdx]?.[action.row];
              const checked = checkedForAction(action.row);
              const damageType = (action.type ?? 'Magic') as 'Magic' | 'Physical' | 'Unique';
              const mit = computeMitigation(action, allVisibleCols, checked, damageType === 'Physical' ? 'Physical' : 'Magic');
              const baseDamage = action.damageHit ?? 0;
              const mitigatedDamage = Math.round(baseDamage * mit);
              const hp = damageType === 'Physical' ? tankHP : maxHP;
              const barrier = computeBarrier(allVisibleCols, checked, hp, computeHealBuff(allVisibleCols, checked));
              const mitPct = baseDamage > 0 ? Math.round((1 - mit) * 100) : null;
              const typeColor = DAMAGE_TYPE_COLORS[action.type ?? ''] ?? '#aaa';

              return (
                <tr key={action.row} className={`action-row ${action.type === 'hide' ? 'hide-row' : ''} ${isRowHidden ? 'row-hidden-dim' : ''}`}>
                  <td className="sticky-col time-cell editable-cell" onClick={() => setEditingRow(action.row)}>
                    {formatTime(action.timeSec)}
                    {isOverridden && <span className="edited-dot" title="Edited" />}
                  </td>
                  <td className="sticky-col action-cell" onDoubleClick={() => setEditingRow(action.row)}>
                    <span className="action-name">{action.name}</span>
                    <button
                      className="edit-action-btn"
                      onClick={() => setEditingRow(action.row)}
                      title="Edit action"
                    >✎</button>
                    <button
                      className={`hide-row-btn ${isRowHidden ? 'hide-row-btn-on' : ''}`}
                      onClick={(e) => { e.stopPropagation(); toggleHideRow(phaseIdx, action.row); if (!showHidden && !isRowHidden) {} }}
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
                  </td>
                  <td className="sticky-col type-cell editable-cell" onDoubleClick={() => setEditingRow(action.row)}>
                    {action.type && DAMAGE_TYPE_ICONS[action.type] ? (
                      <img
                        src={DAMAGE_TYPE_ICONS[action.type]}
                        alt={action.type}
                        title={action.type}
                        width={20}
                        height={20}
                        style={{ display: 'block', margin: 'auto' }}
                      />
                    ) : action.type ? (
                      <span className="type-badge" style={{ backgroundColor: typeColor }}>{action.type}</span>
                    ) : null}
                  </td>
                  <td className="sticky-col dmg-cell editable-cell" onDoubleClick={() => setEditingRow(action.row)}>
                    {baseDamage > 0 ? baseDamage.toLocaleString() : ''}
                  </td>
                  {/* Calc cols */}
                  <td className="calc-col mit-pct-cell">
                    {mitPct !== null ? (
                      <span className={`mit-pct ${mitPct >= 40 ? 'high' : mitPct >= 20 ? 'med' : 'low'}`}>
                        {mitPct}%
                      </span>
                    ) : ''}
                  </td>
                  <td className="calc-col mitigated-cell">
                    {baseDamage > 0 ? (
                      <HPBar
                        damage={mitigatedDamage}
                        barrier={barrier}
                        maxHP={hp}
                      />
                    ) : ''}
                  </td>
                  <td className="calc-col barrier-cell">
                    {barrier > 0 ? barrier.toLocaleString() : ''}
                  </td>
                  {/* Skill checkboxes */}
                  {allVisibleCols.map((sc) => {
                    const rawState = action.mitStates[sc.col];
                    const isUnavailable = rawState === '-' || rawState === false;
                    const isChecked = checked[sc.col] ?? false;

                    if (isUnavailable && rawState === '-') {
                      return (
                        <td key={sc.col} className={`skill-cell unavailable ${colBoundaryClass(sc.col)}`}>
                          <span className="unavail-mark">—</span>
                        </td>
                      );
                    }

                    const coverage = getCoverage(sc.col, action.row);
                    const cellBlocked = isRowHidden || coverage != null;

                    return (
                      <td
                        key={sc.col}
                        className={`skill-cell ${isChecked ? 'checked' : ''} ${coverage ? `coverage-${coverage}` : ''} ${colBoundaryClass(sc.col)}`}
                        title={
                          isRowHidden ? 'Row is marked hidden' :
                          coverage === 'cooldown' ? 'On cooldown' :
                          coverage === 'effect' ? 'Buff active' : undefined
                        }
                        onClick={() => {
                          if (rawState !== '-' && !cellBlocked) toggleMit(phaseIdx, action.row, sc.col);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          tabIndex={-1}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HPBar({ damage, barrier, maxHP }: { damage: number; barrier: number; maxHP: number }) {
  const remaining = maxHP - damage;
  const remainingPct = Math.max(0, Math.min(100, (remaining / maxHP) * 100));
  const barrierPct = Math.min(100 - remainingPct, (barrier / maxHP) * 100);
  const damagePct = 100 - remainingPct - barrierPct;

  const survived = damage <= maxHP + barrier;

  return (
    <div className="hp-bar-wrap" title={`${damage.toLocaleString()} damage, ${barrier.toLocaleString()} barrier, ${remaining.toLocaleString()} remaining`}>
      <div className="hp-bar">
        <div className="hp-life" style={{ width: `${remainingPct}%` }} />
        <div className="hp-barrier" style={{ width: `${barrierPct}%` }} />
        <div className="hp-damage" style={{ width: `${Math.min(damagePct, 100)}%` }} />
      </div>
      <span className={`hp-label ${survived ? '' : 'lethal'}`}>
        {survived ? `${remaining.toLocaleString()}` : 'LETHAL'}
      </span>
    </div>
  );
}
