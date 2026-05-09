import React from 'react';
import { useStore, JOB_DISPLAY_NAMES } from '../store';
import type { Skill, Language } from '../types';

interface Props {
  skills: Skill[];
}

function getSkillName(skill: Skill, lang: Language): string {
  switch (lang) {
    case 'EN': return skill.nameEN || skill.nameJP;
    case 'DE': return skill.nameDE || skill.nameEN || skill.nameJP;
    case 'FR': return skill.nameFR || skill.nameEN || skill.nameJP;
    case 'KO': return skill.nameKO || skill.nameEN || skill.nameJP;
    case 'CN': return skill.nameCN || skill.nameEN || skill.nameJP;
    default: return skill.nameJP;
  }
}

const ROLE_ORDER = ['タンク', 'ナイト', '戦士', '暗黒騎士', 'ガンブレイカー', '白魔道士', '占星術師', '学者', '賢者', 'モンク', '竜騎士', '忍者', '侍', 'リーパー', 'ヴァイパー', '吟遊詩人', '機工士', '踊り子', '黒魔道士', '召喚士', '赤魔道士', 'ピクトマンサー', 'キャスター', '近接'];

export default function SkillDatabase({ skills }: Props) {
  const { language } = useStore();
  const [filter, setFilter] = React.useState('');
  const [jobFilter, setJobFilter] = React.useState('');

  const jobs = React.useMemo(() => {
    const set = new Set(skills.map((s) => s.job));
    return ROLE_ORDER.filter((j) => set.has(j));
  }, [skills]);

  const filtered = React.useMemo(() => {
    const q = filter.toLowerCase();
    return skills.filter((s) => {
      const nameMatch = !q ||
        (s.nameEN ?? '').toLowerCase().includes(q) ||
        s.nameJP.toLowerCase().includes(q);
      const jobMatch = !jobFilter || s.job === jobFilter;
      return nameMatch && jobMatch;
    });
  }, [skills, filter, jobFilter]);

  function mitLabel(val: number | null) {
    if (val === null) return '—';
    return `${Math.round((1 - val) * 100)}%`;
  }

  return (
    <section className="skill-db">
      <div className="skill-db-header">
        <h2>Skill Reference</h2>
        <div className="skill-filters">
          <input
            className="search-input"
            placeholder="Search skills…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select
            className="job-select"
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
          >
            <option value="">All Jobs</option>
            {jobs.map((j) => (
              <option key={j} value={j}>{JOB_DISPLAY_NAMES[j] ?? j}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="skill-table-wrap">
        <table className="skill-table">
          <thead>
            <tr>
              <th>Icon</th>
              <th>Job</th>
              <th>Skill</th>
              <th>Recast</th>
              <th>Duration</th>
              <th>Phys. Mit</th>
              <th>Magic Mit</th>
              <th>Barrier</th>
              <th>Heal</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((skill, i) => (
              <tr key={i} className={skill.isAbility ? 'ability-row' : 'gcd-row'}>
                <td className="icon-cell">
                  {skill.icon && (
                    <img
                      src={skill.icon}
                      alt={skill.nameEN ?? skill.nameJP}
                      width={32}
                      height={32}
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                </td>
                <td className="job-cell">
                  <span className={`job-badge job-${(JOB_DISPLAY_NAMES[skill.job] ?? skill.job).toLowerCase()}`}>
                    {JOB_DISPLAY_NAMES[skill.job] ?? skill.job}
                  </span>
                </td>
                <td className="name-cell">{getSkillName(skill, language)}</td>
                <td>{skill.recast != null ? `${skill.recast}s` : '—'}</td>
                <td>{skill.effectTime != null ? `${skill.effectTime}s` : '—'}</td>
                <td className={skill.mitPhysical != null && skill.mitPhysical < 1 ? 'mit-cell' : ''}>
                  {mitLabel(skill.mitPhysical)}
                </td>
                <td className={skill.mitMagic != null && skill.mitMagic < 1 ? 'mit-cell' : ''}>
                  {mitLabel(skill.mitMagic)}
                </td>
                <td>{skill.barrierAmount != null ? skill.barrierAmount : (skill.barrierTime != null ? `${skill.barrierTime}s` : '—')}</td>
                <td>{skill.healAmount != null ? skill.healAmount : (skill.hotAmount != null ? `${skill.hotAmount}/t` : '—')}</td>
                <td className="notes-cell">
                  {skill.precondition && <span className="badge precond">Req: {skill.precondition}</span>}
                  {skill.healBuffMultiplier && <span className="badge heal-buff">+{Math.round((skill.healBuffMultiplier - 1) * 100)}% Heal</span>}
                  {skill.charge > 1 && <span className="badge charge">×{skill.charge}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
