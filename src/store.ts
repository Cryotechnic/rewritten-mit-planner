import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Phase, Language, Action } from './types';

// phaseIdx ? actionRow ? col ? checked
type MitGrid = Record<number, Record<string, boolean>>;

export type ActionOverride = {
  name?: string;
  timeSec?: number | null;
  type?: string | null;
  damageHit?: number | null;
};

export interface PlanData {
  id: string;
  name: string;
  activePhaseIdx: number;
  mitGrid: Record<number, MitGrid>;
  actionOverrides: Record<number, Record<number, ActionOverride>>;
  hiddenRows: Record<number, Set<number>>;
  customActions: Record<number, Action[]>;
}

function makePlan(id: string, name: string): PlanData {
  return { id, name, activePhaseIdx: 0, mitGrid: {}, actionOverrides: {}, hiddenRows: {}, customActions: {} };
}

const INIT_ID = 'plan-1';

interface PlannerState {
  language: Language;
  showJobs: Record<string, boolean>;
  maxHP: number;
  tankHP: number;
  encounterLevel: number;
  plans: Record<string, PlanData>;
  activePlanId: string;

  setActivePhase: (idx: number) => void;
  setLanguage: (lang: Language) => void;
  toggleJob: (job: string) => void;
  setShowJobs: (jobs: Record<string, boolean>) => void;
  toggleMit: (phaseIdx: number, actionRow: number, col: string) => void;
  setMit: (phaseIdx: number, actionRow: number, col: string, val: boolean) => void;
  setMaxHP: (hp: number) => void;
  setTankHP: (hp: number) => void;
  setEncounterLevel: (lv: number) => void;
  setActionOverride: (phaseIdx: number, row: number, fields: ActionOverride) => void;
  resetActionOverride: (phaseIdx: number, row: number) => void;
  toggleHideRow: (phaseIdx: number, row: number) => void;
  clearHiddenRows: (phaseIdx: number) => void;
  addCustomAction: (phaseIdx: number, action: Action) => void;
  removeCustomAction: (phaseIdx: number, row: number) => void;
  addPlan: (encounterName: string) => void;
  removePlan: (id: string) => void;
  renamePlan: (id: string, name: string) => void;
  setActivePlan: (id: string) => void;
  initPhase: (phaseIdx: number, phase: Phase) => void;
}

function patchActive(s: PlannerState, fn: (p: PlanData) => Partial<PlanData>): Partial<PlannerState> {
  const plan = s.plans[s.activePlanId];
  return { plans: { ...s.plans, [s.activePlanId]: { ...plan, ...fn(plan) } } };
}

const JOB_DISPLAY_NAMES: Record<string, string> = {
  '???': 'PLD',
  '??': 'WAR',
  '????': 'DRK',
  '???????': 'GNB',
  '????': 'WHM',
  '????': 'AST',
  '??': 'SCH',
  '??': 'SGE',
  '???': 'MNK',
  '???': 'DRG',
  '??': 'NIN',
  '?': 'SAM',
  '????': 'RPR',
  '?????': 'VPR',
  '????': 'BRD',
  '???': 'MCH',
  '???': 'DNC',
  '????': 'BLM',
  '???': 'SMN',
  '????': 'RDM',
  '???????': 'PCT',
  '?????': 'CAST',
  '??': 'MELEE',
  '???': 'LB',
};

export { JOB_DISPLAY_NAMES };

export const useStore = create<PlannerState>()(
  persist(
    (set, get) => ({
      language: 'EN',
      showJobs: {},
      maxHP: 142000,
      tankHP: 225800,
      encounterLevel: 70,
      plans: { [INIT_ID]: makePlan(INIT_ID, '') },
      activePlanId: INIT_ID,

      setActivePhase: (idx) => set((s) => patchActive(s, () => ({ activePhaseIdx: idx }))),

      setLanguage: (lang) => set({ language: lang }),

      toggleJob: (job) => set((s) => {
        if (s.showJobs[job] === false) {
          const next = { ...s.showJobs };
          delete next[job];
          return { showJobs: next };
        }
        return { showJobs: { ...s.showJobs, [job]: false } };
      }),

      setShowJobs: (jobs) => set({ showJobs: jobs }),

      toggleMit: (phaseIdx, actionRow, col) => {
        const p = get().plans[get().activePlanId];
        const current = p.mitGrid[phaseIdx]?.[actionRow]?.[col] ?? false;
        set((s) => patchActive(s, (plan) => ({
          mitGrid: {
            ...plan.mitGrid,
            [phaseIdx]: {
              ...(plan.mitGrid[phaseIdx] ?? {}),
              [actionRow]: { ...(plan.mitGrid[phaseIdx]?.[actionRow] ?? {}), [col]: !current },
            },
          },
        })));
      },

      setMit: (phaseIdx, actionRow, col, val) => set((s) => patchActive(s, (plan) => ({
        mitGrid: {
          ...plan.mitGrid,
          [phaseIdx]: {
            ...(plan.mitGrid[phaseIdx] ?? {}),
            [actionRow]: { ...(plan.mitGrid[phaseIdx]?.[actionRow] ?? {}), [col]: val },
          },
        },
      }))),

      setMaxHP: (hp) => set({ maxHP: hp }),
      setTankHP: (hp) => set({ tankHP: hp }),
      setEncounterLevel: (lv) => set({ encounterLevel: lv }),

      setActionOverride: (phaseIdx, row, fields) => set((s) => patchActive(s, (plan) => ({
        actionOverrides: {
          ...plan.actionOverrides,
          [phaseIdx]: {
            ...(plan.actionOverrides[phaseIdx] ?? {}),
            [row]: { ...(plan.actionOverrides[phaseIdx]?.[row] ?? {}), ...fields },
          },
        },
      }))),

      resetActionOverride: (phaseIdx, row) => set((s) => patchActive(s, (plan) => {
        const phase = { ...(plan.actionOverrides[phaseIdx] ?? {}) };
        delete phase[row];
        return { actionOverrides: { ...plan.actionOverrides, [phaseIdx]: phase } };
      })),

      toggleHideRow: (phaseIdx, row) => set((s) => patchActive(s, (plan) => {
        const prev = plan.hiddenRows[phaseIdx] ?? new Set<number>();
        const next = new Set(prev);
        if (next.has(row)) next.delete(row); else next.add(row);
        return { hiddenRows: { ...plan.hiddenRows, [phaseIdx]: next } };
      })),

      clearHiddenRows: (phaseIdx) => set((s) => patchActive(s, (plan) => ({
        hiddenRows: { ...plan.hiddenRows, [phaseIdx]: new Set<number>() },
      }))),

      addCustomAction: (phaseIdx, action) => set((s) => patchActive(s, (plan) => ({
        customActions: {
          ...plan.customActions,
          [phaseIdx]: [...(plan.customActions[phaseIdx] ?? []), action],
        },
      }))),

      removeCustomAction: (phaseIdx, row) => set((s) => patchActive(s, (plan) => ({
        customActions: {
          ...plan.customActions,
          [phaseIdx]: (plan.customActions[phaseIdx] ?? []).filter((a) => a.row !== row),
        },
      }))),

      addPlan: (encounterName) => set((s) => {
        const id = `plan-${Date.now()}`;
        return {
          plans: { ...s.plans, [id]: makePlan(id, encounterName) },
          activePlanId: id,
        };
      }),

      removePlan: (id) => set((s) => {
        const keys = Object.keys(s.plans);
        if (keys.length <= 1) return {};
        const next = { ...s.plans };
        delete next[id];
        const activePlanId = s.activePlanId === id ? Object.keys(next)[0] : s.activePlanId;
        return { plans: next, activePlanId };
      }),

      renamePlan: (id, name) => set((s) => ({
        plans: { ...s.plans, [id]: { ...s.plans[id], name } },
      })),

      setActivePlan: (id) => set({ activePlanId: id }),

      initPhase: (phaseIdx, phase) => {
        const grid: MitGrid = {};
        for (const action of phase.actions) {
          grid[action.row] = {};
          for (const [col, val] of Object.entries(action.mitStates)) {
            grid[action.row][col] = val === true || val === 1;
          }
        }
        set((s) => {
          const plan = s.plans[s.activePlanId];
          if (plan.mitGrid[phaseIdx]) return {};
          return patchActive(s, (p) => ({
            mitGrid: { ...p.mitGrid, [phaseIdx]: grid },
          }));
        });
      },
    }),
    {
      name: 'ucob-planner-state',
      version: 1,
      storage: createJSONStorage(() => localStorage, {
        replacer: (_key, value) =>
          value instanceof Set ? { __type: 'Set', values: [...value] } : value,
        reviver: (_key, value) =>
          value && typeof value === 'object' && (value as any).__type === 'Set'
            ? new Set((value as any).values)
            : value,
      }),
      migrate: (persisted: any, version: number) => {
        if (version === 0) {
          return {
            ...persisted,
            plans: {
              [INIT_ID]: {
                id: INIT_ID,
                name: 'Plan 1',
                activePhaseIdx: persisted.activePhaseIdx ?? 0,
                mitGrid: persisted.mitGrid ?? {},
                actionOverrides: persisted.actionOverrides ?? {},
                hiddenRows: persisted.hiddenRows ?? {},
                customActions: persisted.customActions ?? {},
              },
            },
            activePlanId: INIT_ID,
          };
        }
        return persisted;
      },
      partialize: (s) => ({
        language: s.language,
        showJobs: s.showJobs,
        maxHP: s.maxHP,
        tankHP: s.tankHP,
        encounterLevel: s.encounterLevel,
        plans: s.plans,
        activePlanId: s.activePlanId,
      }),
    }
  )
);
