import type { Action, SkillCol } from './types';

/**
 * Compute combined mitigation multiplier for a given action,
 * based on which skill checkboxes are checked.
 *
 * Returns a value between 0 and 1 where 1 = no mitigation, 0.5 = 50% mit.
 */
export function computeMitigation(
  action: Action,
  skillCols: SkillCol[],
  checkedCols: Record<string, boolean>,
  damageType: 'Magic' | 'Physical' | 'Unique'
): number {
  let combined = 1.0;
  for (const sc of skillCols) {
    if (!checkedCols[sc.col]) continue;

    // Skip cols with '-' (unavailable/charge marker)
    const rawState = action.mitStates[sc.col];
    if (rawState === '-') continue;

    let mit: number | null = null;
    if (damageType === 'Magic') mit = sc.mitMagic;
    else if (damageType === 'Physical') mit = sc.mitPhysical;
    else mit = sc.mitUnique; // null = skill doesn't apply to Unique/tankbuster, no fallback

    // mit === 1 means "skill active but no reduction" (e.g. Holmgang) — skip for perf
    if (mit !== null && mit > 0 && mit < 1) {
      combined *= mit;
    }
  }
  return combined;
}

/**
 * Compute total barrier from checked barrier skills.
 * Stored barrier coefficients are per-mille of maxHP (÷1000), so scale accordingly.
 * barrierBuff on a skill multiplies all barrier-granting skills (they are separate).
 */
export function computeBarrier(
  skillCols: SkillCol[],
  checkedCols: Record<string, boolean>,
  maxHP = 1,
  healBuffMultiplier = 1.0
): number {
  // Sum additive barrier buff multipliers (e.g. Divine Veil +10%)
  let barrierMult = 1.0;
  for (const sc of skillCols) {
    if (!checkedCols[sc.col]) continue;
    if (sc.barrierBuff) barrierMult += sc.barrierBuff;
  }
  // Sum flat barriers, each scaled from per-mille coefficient to actual HP
  let total = 0;
  for (const sc of skillCols) {
    if (!checkedCols[sc.col]) continue;
    if (sc.barrier) total += sc.barrier * (maxHP / 1000);
  }
  return total * barrierMult * healBuffMultiplier;
}

/**
 * Compute heal buff multiplier from checked skills for a given job role.
 */
export function computeHealBuff(
  skillCols: SkillCol[],
  checkedCols: Record<string, boolean>,
  role: 'ALL' | 'WHM' | 'AST' | 'SCH' | 'SGE' | string = 'ALL'
): number {
  let mult = 1.0;
  for (const sc of skillCols) {
    if (!checkedCols[sc.col]) continue;
    if (sc.healBuff) {
      const tgt = sc.healBuffTarget ?? '';
      const applies =
        tgt.includes('ALL') ||
        tgt.includes('RANGE_AFFECTED_ALL') ||
        (role !== 'ALL' && tgt.includes(role)) ||
        role === 'ALL';
      if (applies) {
        mult *= sc.healBuff;
      }
    }
  }
  return mult;
}

export function formatTime(sec: number | null): string {
  if (sec === null) return '';
  const sign = sec < 0 ? '-' : '';
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = (abs % 60).toFixed(1).padStart(4, '0');
  return `${sign}${m}:${s}`;
}

export function pct(val: number | null): string {
  if (val === null) return '';
  return `${Math.round((1 - val) * 100)}%`;
}
