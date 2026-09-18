import { useAppStore } from '@/lib/store'

import { readChaosSettingsFromSearch } from './chaos-url'
import { installChaosApi } from './chaos-window'

/**
 * Runs once at startup: the query string decides the conditions, then the console handle goes
 * on. Both happen before the first render, so the first request already runs under whatever
 * the reviewer asked for.
 */
export function bootstrapChaos(target: Window) {
  const fromUrl = readChaosSettingsFromSearch(target.location.search)

  if (Object.keys(fromUrl).length > 0) {
    useAppStore.getState().setSettings(fromUrl)
  }

  installChaosApi(target)
}
