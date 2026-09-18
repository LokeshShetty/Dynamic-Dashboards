import type { StateCreator } from 'zustand'

import { DEFAULT_CHAOS_SETTINGS, EMPTY_CHAOS_MUTATIONS } from '@/chaos/_constants'
import type { FieldType } from '@/constants/data'
import type { ChaosSettings, ChaosSnapshot } from '@/types/chaos'

export type ChaosSlice = ChaosSnapshot & {
  setSettings: (settings: Partial<ChaosSettings>) => void
  corruptNextResponse: boolean
  /** Spends the armed corruption, so it applies to exactly one response. */
  takeCorruption: () => boolean
  renameField: (dataset: string, from: string, to: string) => void
  changeFieldType: (dataset: string, field: string, type: FieldType) => void
  dropDataset: (dataset: string) => void
  restoreWorld: () => void
  reset: () => void
}

const INITIAL_STATE: ChaosSnapshot = {
  ...DEFAULT_CHAOS_SETTINGS,
  ...EMPTY_CHAOS_MUTATIONS,
  epoch: 0,
}

export const createChaosSlice: StateCreator<ChaosSlice> = (set, get) => ({
  ...INITIAL_STATE,

  setSettings: (settings) => set(settings),

  takeCorruption: () => {
    if (!get().corruptNextResponse) return false
    set({ corruptNextResponse: false })
    return true
  },

  renameField: (dataset, from, to) =>
    set((state) => ({
      renamedFields: {
        ...state.renamedFields,
        [dataset]: { ...state.renamedFields[dataset], [from]: to },
      },
      epoch: state.epoch + 1,
    })),

  changeFieldType: (dataset, field, type) =>
    set((state) => ({
      retypedFields: {
        ...state.retypedFields,
        [dataset]: { ...state.retypedFields[dataset], [field]: type },
      },
      epoch: state.epoch + 1,
    })),

  dropDataset: (dataset) =>
    set((state) =>
      state.droppedDatasets.includes(dataset)
        ? state
        : { droppedDatasets: [...state.droppedDatasets, dataset], epoch: state.epoch + 1 },
    ),

  restoreWorld: () => set((state) => ({ ...EMPTY_CHAOS_MUTATIONS, epoch: state.epoch + 1 })),

  reset: () => set((state) => ({ ...INITIAL_STATE, epoch: state.epoch + 1 })),
})
