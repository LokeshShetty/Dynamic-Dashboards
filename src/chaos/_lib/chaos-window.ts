import type { FieldType } from '@/constants/data'
import { log } from '@/lib/log'
import { useAppStore } from '@/lib/store'
import type { ChaosSettings, ChaosSnapshot } from '@/types/chaos'

/**
 * The console handle. Everything the panel can do is available here, so a reviewer can make
 * the world worse mid-render without hunting for a control, and so a test can drive the same
 * knobs the reviewer does.
 */
export type ChaosApi = {
  get: () => ChaosSnapshot
  set: (settings: Partial<ChaosSettings>) => void
  corruptNextResponse: () => void
  renameField: (dataset: string, from: string, to: string) => void
  changeFieldType: (dataset: string, field: string, type: FieldType) => void
  dropDataset: (dataset: string) => void
  restoreWorld: () => void
  reset: () => void
}

declare global {
  interface Window {
    __chaos?: ChaosApi
  }
}

export function createChaosApi(): ChaosApi {
  return {
    get: () => useAppStore.getState(),
    set: (settings) => useAppStore.getState().setSettings(settings),
    corruptNextResponse: () => useAppStore.getState().setSettings({ corruptNextResponse: true }),
    renameField: (dataset, from, to) => useAppStore.getState().renameField(dataset, from, to),
    changeFieldType: (dataset, field, type) =>
      useAppStore.getState().changeFieldType(dataset, field, type),
    dropDataset: (dataset) => useAppStore.getState().dropDataset(dataset),
    restoreWorld: () => useAppStore.getState().restoreWorld(),
    reset: () => useAppStore.getState().reset(),
  }
}

export function installChaosApi(target: Window) {
  target.__chaos = createChaosApi()
  log.info('chaos.api.installed', { usage: 'window.__chaos.set({ latencyMs: 4000 })' })
}
