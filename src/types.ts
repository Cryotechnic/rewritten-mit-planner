export interface Skill {
  job: string;
  nameJP: string;
  nameEN: string | null;
  nameDE: string | null;
  nameFR: string | null;
  nameKO: string | null;
  nameCN: string | null;
  icon: string | null;
  level: number;
  effectTime: number | null;
  recast: number | null;
  isAbility: boolean;
  assign: string | null;
  charge: number;
  mitMagic: number | null;
  mitPhysical: number | null;
  mitUnique: number | null;
  critMitMagic: number | null;
  critMitPhysical: number | null;
  barrierAmount: number | null;
  healAmount: number | null;
  hotTime: number | null;
  hotAmount: number | null;
  barrierTime: number | null;
  healBuffTarget: string | null;
  healBuffTime: number | null;
  healBuffAmount: number | null;
  healBuffMultiplier: number | null;
  barrierBuffTime: number | null;
  barrierBuffAmount: number | null;
  precondition: string | null;
  availSkillTime: number | null;
  availSkill: string | null;
  timerShared: string | null;
}

export interface SkillCol {
  col: string;
  job: string;
  skill: string;
  assign: string | null;
  charge: number;
  isAbility: boolean;
  effectTime: number | null;
  recast: number | null;
  mitPhysical: number | null;
  mitMagic: number | null;
  mitUnique: number | null;
  healBuffTarget: string | null;
  healBuff: number | null;
  barrierBuff: number | null;
  barrier: number | null;
}

export interface Action {
  row: number;
  timeSec: number | null;
  name: string | null;
  type: string | null;
  damageHit: number | null;
  damageDot: number | null;
  damageTick: number | null;
  mitStates: Record<string, boolean | string | number>;
}

export interface Phase {
  name: string;
  skillCols: SkillCol[];
  actions: Action[];
}

export interface Options {
  jobHP: Record<string, number>;
  jobMND: Record<string, number>;
  defaultHP: number;
  tankHP: number;
}

export interface UcobData {
  skills: Skill[];
  phases: Phase[];
  options: Options;
}

export type Language = 'JP' | 'EN' | 'DE' | 'FR' | 'KO' | 'CN';
