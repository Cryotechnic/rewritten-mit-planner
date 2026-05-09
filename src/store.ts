import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Phase, Language, Action } from './types';

// mitStates[phaseIndex][actionRow][col] = checked boolean
type MitGrid = Record<number, Record<string, boolean>>;

export type ActionOverride = {
  name?: string;
  timeSec?: number | null;
  type?: string | null;
  damageHit?: number | null;
};

interface PlannerState {
  activePhaseIdx: number;
  language: Language;
  showJobs: Record<string, boolean>;
  mitGrid: Record<number, MitGrid>; // phaseIdx -> actionRow -> col -> checked
  maxHP: number;
  tankHP: number;
  encounterLevel: number;
  actionOverrides: Record<number, Record<number, ActionOverride>>;
  hiddenRows: Record<number, Set<number>>; // phaseIdx -> set of hidden row ids
  customActions: Record<number, Action[]>; // phaseIdx -> custom action rows

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

  // Initialize mit states from loaded data for a phase
  initPhase: (phaseIdx: number, phase: Phase) => void;
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
  'タンク': 'TANK',
};

export { JOB_DISPLAY_NAMES };

export const useStore = create<PlannerState>()(
  persist(
    (set, get) => ({
  activePhaseIdx: 0,
  language: 'EN',
  showJobs: {},
  mitGrid: {},
  maxHP: 142000,
  tankHP: 225800,
  encounterLevel: 70,
  actionOverrides: {},
  hiddenRows: {},
  customActions: {},

  setActivePhase: (idx) => set({ activePhaseIdx: idx }),
  setLanguage: (lang) => set({ language: lang }),

  toggleJob: (job) => set((s) => {
    if (s.showJobs[job] === false) {
      // Unhide: remove entry so job reverts to "visible"
      const next = { ...s.showJobs };
      delete next[job];
      return { showJobs: next };
    }
    // Hide: set to false
    return { showJobs: { ...s.showJobs, [job]: false } };
  }),

  setShowJobs: (jobs) => set({ showJobs: jobs }),

  toggleMit: (phaseIdx, actionRow, col) => {
    const current = get().mitGrid[phaseIdx]?.[actionRow]?.[col] ?? false;
    set((s) => ({
      mitGrid: {
        ...s.mitGrid,
        [phaseIdx]: {
          ...(s.mitGrid[phaseIdx] ?? {}),
          [actionRow]: {
            ...(s.mitGrid[phaseIdx]?.[actionRow] ?? {}),
            [col]: !current,
          },
        },
      },
    }));
  },

  setMit: (phaseIdx, actionRow, col, val) => {
    set((s) => ({
      mitGrid: {
        ...s.mitGrid,
        [phaseIdx]: {
          ...(s.mitGrid[phaseIdx] ?? {}),
          [actionRow]: {
            ...(s.mitGrid[phaseIdx]?.[actionRow] ?? {}),
            [col]: val,
          },
        },
      },
    }));
  },

  setMaxHP: (hp) => set({ maxHP: hp }),
  setTankHP: (hp) => set({ tankHP: hp }),
  setEncounterLevel: (lv) => set({ encounterLevel: lv }),

  setActionOverride: (phaseIdx, row, fields) => set((s) => ({
    actionOverrides: {
      ...s.actionOverrides,
      [phaseIdx]: {
        ...(s.actionOverrides[phaseIdx] ?? {}),
        [row]: { ...(s.actionOverrides[phaseIdx]?.[row] ?? {}), ...fields },
      },
    },
  })),

  resetActionOverride: (phaseIdx, row) => set((s) => {
    const phase = { ...(s.actionOverrides[phaseIdx] ?? {}) };
    delete phase[row];
    return { actionOverrides: { ...s.actionOverrides, [phaseIdx]: phase } };
  }),

  toggleHideRow: (phaseIdx, row) => set((s) => {
    const prev = s.hiddenRows[phaseIdx] ?? new Set<number>();
    const next = new Set(prev);
    if (next.has(row)) next.delete(row); else next.add(row);
    return { hiddenRows: { ...s.hiddenRows, [phaseIdx]: next } };
  }),

  clearHiddenRows: (phaseIdx) => set((s) => ({
    hiddenRows: { ...s.hiddenRows, [phaseIdx]: new Set<number>() },
  })),

  addCustomAction: (phaseIdx, action) => set((s) => ({
    customActions: {
      ...s.customActions,
      [phaseIdx]: [...(s.customActions[phaseIdx] ?? []), action],
    },
  })),

  removeCustomAction: (phaseIdx, row) => set((s) => ({
    customActions: {
      ...s.customActions,
      [phaseIdx]: (s.customActions[phaseIdx] ?? []).filter((a) => a.row !== row),
    },
  })),

  initPhase: (phaseIdx, phase) => {
    const grid: MitGrid = {};
    for (const action of phase.actions) {
      grid[action.row] = {};
      for (const [col, val] of Object.entries(action.mitStates)) {
        grid[action.row][col] = val === true || val === 1;
      }
    }
    set((s) => ({
      mitGrid: { ...s.mitGrid, [phaseIdx]: s.mitGrid[phaseIdx] ?? grid },
    }));
  },
}),
    {
      name: 'ucob-planner-state',
      storage: createJSONStorage(() => localStorage, {
        replacer: (_key, value) =>
          value instanceof Set ? { __type: 'Set', values: [...value] } : value,
        reviver: (_key, value) =>
          value && typeof value === 'object' && (value as any).__type === 'Set'
            ? new Set((value as any).values)
            : value,
      }),
      partialize: (s) => ({
        mitGrid: s.mitGrid,
        showJobs: s.showJobs,
        language: s.language,
        maxHP: s.maxHP,
        tankHP: s.tankHP,
        encounterLevel: s.encounterLevel,
        actionOverrides: s.actionOverrides,
        hiddenRows: s.hiddenRows,
        customActions: s.customActions,
        activePhaseIdx: s.activePhaseIdx,
      }),
    }
  )
);
