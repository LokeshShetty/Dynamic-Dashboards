import { STORAGE_INDEX_KEY, STORAGE_KEY_PREFIX, STORAGE_SEED_KEY } from '../_constants'
import type { DashboardStore } from '../_types'
import { localDashboardStore } from './local-dashboard-store'
import { hasSeeded, seedDashboards } from './seed'

/**
 * The one place the backend is chosen. Everything else imports this, so swapping localStorage
 * for a REST implementation is this file and nothing above it.
 */
export const dashboardStore: DashboardStore = localDashboardStore

/**
 * Seeding runs once, before the first read, and outside the chaos transport: a reader whose
 * first request is refused should still find dashboards to open when they retry.
 */
export function ensureSeeded() {
  try {
    const store = globalThis.localStorage
    if (!store || typeof store.getItem !== 'function' || typeof store.setItem !== 'function') return

    if (hasSeeded((key) => store.getItem(key))) return

    seedDashboards({
      write: (key, value) => store.setItem(key, value),
      writeIndex: (ids) => store.setItem(STORAGE_INDEX_KEY, JSON.stringify([...new Set(ids)])),
      readIndex: () => {
        const raw = store.getItem(STORAGE_INDEX_KEY)
        if (raw === null) return []
        const parsed: unknown = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
      },
    })
  } catch {
    // A browser that refuses storage is handled per request, with a visible reason.
  }
}

export function storageKeyFor(id: string) {
  return `${STORAGE_KEY_PREFIX}${id}`
}

export function seedMarkerKey() {
  return STORAGE_SEED_KEY
}
