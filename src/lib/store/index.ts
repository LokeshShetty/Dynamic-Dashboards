import { create } from 'zustand'

import { createChaosSlice, type ChaosSlice } from './slices/chaos.slice'
import { createToastSlice, type ToastSlice } from './slices/toast.slice'

export type AppStore = ChaosSlice & ToastSlice

/**
 * One store. The data layer reads it outside React with useAppStore.getState(), which is why
 * chaos lives here rather than in React state: a request has to see the conditions in force
 * at the moment it runs, not the ones that were rendered.
 */
export const useAppStore = create<AppStore>()((...args) => ({
  ...createChaosSlice(...args),
  ...createToastSlice(...args),
}))
