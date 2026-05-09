import { create } from 'zustand';
import type { Phase, Language } from './types';

// mitStates[phaseIndex][actionRow][col] = checked boolean
type MitGrid = Record<number, Record<string, boolean>>;

interface PlannerState {
  activePhaseIdx: number;
  language: Language;
  showJobs: Record<string, boolean>;
  mitGrid: Record<number, MitGrid>; // phaseIdx -> actionRow -> col -> checked
  maxHP: number;
  tankHP: number;

  setActivePhase: (idx: number) => void;
  setLanguage: (lang: Language) => void;
  toggleJob: (job: string) => void;
  setShowJobs: (jobs: Record<string, boolean>) => void;
  toggleMit: (phaseIdx: number, actionRow: number, col: string) => void;
  setMit: (phaseIdx: number, actionRow: number, col: string, val: boolean) => void;
  setMaxHP: (hp: number) => void;
  setTankHP: (hp: number) => void;

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

export const useStore = create<PlannerState>((set, get) => ({
  activePhaseIdx: 0,
  language: 'EN',
  showJobs: {},
  mitGrid: {},
  maxHP: 142000,
  tankHP: 225800,

  setActivePhase: (idx) => set({ activePhaseIdx: idx }),
  setLanguage: (lang) => set({ language: lang }),

  toggleJob: (job) => set((s) => ({
    showJobs: { ...s.showJobs, [job]: !s.showJobs[job] },
  })),

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
}));
