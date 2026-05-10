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

export interface CustomPhaseEntry {
  id: string;
  name: string;
}

export interface PlanData {
  id: string;
  name: string;
  activePhaseIdx: number;
  hiddenPhases: Set<number>;
  customPhases: CustomPhaseEntry[];
  mitGrid: Record<number, MitGrid>;
  actionOverrides: Record<number, Record<number, ActionOverride>>;
  hiddenRows: Record<number, Set<number>>;
  customActions: Record<number, Action[]>;
  baseActionsCleared: boolean;
}

function makePlan(id: string, name: string): PlanData {
  return { id, name, activePhaseIdx: 0, hiddenPhases: new Set(), customPhases: [], mitGrid: {}, actionOverrides: {}, hiddenRows: {}, customActions: {}, baseActionsCleared: false };
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
  // Sync state (not persisted)
  shareId: string | null;
  clientId: string;

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
  clearPhase: (phaseIdx: number) => void;
  clearPlan: () => void;
  clearAllPlans: () => void;
  clearPlanActions: () => void;
  restoreBaseActions: () => void;
  addCustomAction: (phaseIdx: number, action: Action) => void;
  removeCustomAction: (phaseIdx: number, row: number) => void;
  addPlan: (encounterName: string) => void;
  removePlan: (id: string) => void;
  renamePlan: (id: string, name: string) => void;
  setActivePlan: (id: string) => void;
  toggleHidePhase: (phaseIdx: number, totalPhases: number) => void;
  addCustomPhase: (name: string, dataPhaseCount: number) => void;
  removeCustomPhase: (phaseIdx: number, dataPhaseCount: number) => void;
  renameCustomPhase: (phaseIdx: number, name: string, dataPhaseCount: number) => void;
  initPhase: (phaseIdx: number, phase: Phase) => void;
  setShareId: (id: string | null) => void;
  applyRemotePlan: (plans: Record<string, PlanData>, activePlanId: string, settings?: { maxHP?: number; tankHP?: number; encounterLevel?: number }) => void;
}

function patchActive(s: PlannerState, fn: (p: PlanData) => Partial<PlanData>): Partial<PlannerState> {
  const plan = s.plans[s.activePlanId];
  return { plans: { ...s.plans, [s.activePlanId]: { ...plan, ...fn(plan) } } };
}

const JOB_DISPLAY_NAMES: Record<string, string> = {
  'ナイト': 'PLD',
  '戦士': 'WAR',
  '暗黒騎士': 'DRK',
  'ガンブレイカー': 'GNB',
  '白魔道士': 'WHM',
  '占星術師': 'AST',
  '学者': 'SCH',
  '賢者': 'SGE',
  'モンク': 'MNK',
  '竜騎士': 'DRG',
  '忍者': 'NIN',
  '侍': 'SAM',
  'リーパー': 'RPR',
  'ヴァイパー': 'VPR',
  '吟遊詩人': 'BRD',
  '機工士': 'MCH',
  '踊り子': 'DNC',
  '黒魔道士': 'BLM',
  '召喚士': 'SMN',
  '赤魔道士': 'RDM',
  'ピクトマンサー': 'PCT',
  'キャスター': 'CAST',
  '近接': 'MELEE',
  'タンク': 'LB',
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
      shareId: null,
      clientId: Math.random().toString(36).slice(2),

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

      clearPhase: (phaseIdx) => set((s) => patchActive(s, (plan) => ({
        mitGrid: { ...plan.mitGrid, [phaseIdx]: {} },
      }))),

      clearPlan: () => set((s) => patchActive(s, () => ({
        mitGrid: {},
      }))),

      clearAllPlans: () => set((s) => ({
        plans: Object.fromEntries(
          Object.entries(s.plans).map(([id, plan]) => [id, { ...plan, mitGrid: {} }])
        ),
      })),

      clearPlanActions: () => set((s) => patchActive(s, () => ({
        mitGrid: {},
        actionOverrides: {},
        customActions: {},
        hiddenRows: {},
        baseActionsCleared: true,
      }))),

      restoreBaseActions: () => set((s) => patchActive(s, () => ({
        baseActionsCleared: false,
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

      addCustomPhase: (name, dataPhaseCount) => set((s) => patchActive(s, (plan) => {
        const id = `custom-phase-${Date.now()}`;
        const newCustomPhases = [...(plan.customPhases ?? []), { id, name }];
        const newPhaseIdx = dataPhaseCount + newCustomPhases.length - 1;
        return { customPhases: newCustomPhases, activePhaseIdx: newPhaseIdx };
      })),

      removeCustomPhase: (phaseIdx, dataPhaseCount) => set((s) => patchActive(s, (plan) => {
        const customIdx = phaseIdx - dataPhaseCount;
        const next = (plan.customPhases ?? []).filter((_, i) => i !== customIdx);
        const newMitGrid = { ...plan.mitGrid };
        const newActionOverrides = { ...plan.actionOverrides };
        const newHiddenRows = { ...plan.hiddenRows };
        const newCustomActions = { ...plan.customActions };
        delete newMitGrid[phaseIdx];
        delete newActionOverrides[phaseIdx];
        delete newHiddenRows[phaseIdx];
        delete newCustomActions[phaseIdx];
        const hiddenNext = new Set(plan.hiddenPhases ?? []);
        hiddenNext.delete(phaseIdx);
        const activePhaseIdx = plan.activePhaseIdx === phaseIdx
          ? Math.max(0, phaseIdx - 1)
          : plan.activePhaseIdx > phaseIdx ? plan.activePhaseIdx - 1 : plan.activePhaseIdx;
        return { customPhases: next, mitGrid: newMitGrid, actionOverrides: newActionOverrides, hiddenRows: newHiddenRows, customActions: newCustomActions, hiddenPhases: hiddenNext, activePhaseIdx };
      })),

      renameCustomPhase: (phaseIdx, name, dataPhaseCount) => set((s) => patchActive(s, (plan) => {
        const customIdx = phaseIdx - dataPhaseCount;
        const next = [...(plan.customPhases ?? [])];
        if (next[customIdx]) next[customIdx] = { ...next[customIdx], name };
        return { customPhases: next };
      })),

      toggleHidePhase: (phaseIdx, totalPhases) => set((s) => patchActive(s, (plan) => {
        const next = new Set(plan.hiddenPhases ?? []);
        if (next.has(phaseIdx)) {
          next.delete(phaseIdx);
        } else {
          next.add(phaseIdx);
          // If we're hiding the active phase, jump to first visible phase
          if (plan.activePhaseIdx === phaseIdx) {
            const firstVisible = Array.from({ length: totalPhases }, (_, i) => i).find((i) => !next.has(i)) ?? 0;
            return { hiddenPhases: next, activePhaseIdx: firstVisible };
          }
        }
        return { hiddenPhases: next };
      })),

      setShareId: (id) => set({ shareId: id }),

      applyRemotePlan: (plans, activePlanId, settings) => set({
        plans,
        activePlanId,
        ...(settings?.maxHP !== undefined && { maxHP: settings.maxHP }),
        ...(settings?.tankHP !== undefined && { tankHP: settings.tankHP }),
        ...(settings?.encounterLevel !== undefined && { encounterLevel: settings.encounterLevel }),
      }),

      initPhase: (phaseIdx, phase) => {
        // Check before calling set() — returning {} from set() still triggers a re-render
        const plan = get().plans[get().activePlanId];
        if (plan.mitGrid[phaseIdx]) return;
        const grid: MitGrid = {};
        for (const action of phase.actions) {
          grid[action.row] = {};
          for (const col of Object.keys(action.mitStates)) {
            grid[action.row][col] = false;
          }
        }
        set((s) => patchActive(s, (p) => ({
          mitGrid: { ...p.mitGrid, [phaseIdx]: grid },
        })));
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
