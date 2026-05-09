import React from 'react';
import { useStore, JOB_DISPLAY_NAMES } from '../store';
import type { Phase, Skill, Language } from '../types';
import { computeMitigation, computeBarrier, formatTime } from '../calc';

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

export default function MitigationGrid({ phaseIdx, phase, skills }: Props) {
  const { language, mitGrid, toggleMit, initPhase, showJobs, maxHP, tankHP } = useStore();

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

  // Group skill columns by job
  const colGroups = React.useMemo<ColGroup[]>(() => {
    const map = new Map<string, Phase['skillCols']>();
    for (const sc of phase.skillCols) {
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
  }, [phase.skillCols]);

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

  return (
    <div className="mit-grid-wrap">
      {/* Job filter toggles */}
      <div className="job-toggles">
        {colGroups.map((g) => (
          <React.Fragment key={g.job}>
            {g.isRoleStart && colGroups.indexOf(g) !== 0 && (
              <span className="role-divider" />
            )}
            <button
              className={`job-toggle ${showJobs[g.job] === false ? 'hidden' : 'visible'}`}
              onClick={() => useStore.getState().toggleJob(g.job)}
            >
              {JOB_DISPLAY_NAMES[g.job] ?? g.job}
            </button>
          </React.Fragment>
        ))}
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
            {actions.map((action) => {
              const checked = checkedForAction(action.row);
              const damageType = (action.type ?? 'Magic') as 'Magic' | 'Physical' | 'Unique';
              const mit = computeMitigation(action, allVisibleCols, checked, damageType === 'Physical' ? 'Physical' : 'Magic');
              const baseDamage = action.damageHit ?? 0;
              const mitigatedDamage = Math.round(baseDamage * mit);
              const barrier = computeBarrier(allVisibleCols, checked);
              const mitPct = baseDamage > 0 ? Math.round((1 - mit) * 100) : null;
              const hp = damageType === 'Physical' ? tankHP : maxHP;
              const typeColor = DAMAGE_TYPE_COLORS[action.type ?? ''] ?? '#aaa';

              return (
                <tr key={action.row} className={`action-row ${action.type === 'hide' ? 'hide-row' : ''}`}>
                  <td className="sticky-col time-cell">
                    {formatTime(action.timeSec)}
                  </td>
                  <td className="sticky-col action-cell">{action.name}</td>
                  <td className="sticky-col type-cell">
                    <span className="type-badge" style={{ backgroundColor: typeColor }}>
                      {action.type}
                    </span>
                  </td>
                  <td className="sticky-col dmg-cell">
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

                    return (
                      <td
                        key={sc.col}
                        className={`skill-cell ${isChecked ? 'checked' : ''} ${colBoundaryClass(sc.col)}`}
                        onClick={() => {
                          if (rawState !== '-') toggleMit(phaseIdx, action.row, sc.col);
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
