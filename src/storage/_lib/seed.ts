import v1Text from '@/dashboard/_fixtures/dashboard-v1.json?raw'
import v2Text from '@/dashboard/_fixtures/dashboard-v2.json?raw'
import v3Text from '@/dashboard/_fixtures/dashboard-v3.json?raw'

import { STORAGE_INDEX_KEY, STORAGE_KEY_PREFIX, STORAGE_SEED_KEY } from '../_constants'
import type { StoredDashboard } from './storage.schema'

/**
 * The dashboards a first visit starts with. Two of them are written in older configuration
 * formats on purpose: they are the proof that an old dashboard still opens.
 */
const SEEDS: ReadonlyArray<{ id: string; config: string }> = [
  { id: 'demo', config: v3Text },
  { id: 'legacy-v2', config: v2Text },
  { id: 'legacy-v1', config: v1Text },
]

type StorageIo = {
  write: (key: string, value: string) => void
  writeIndex: (ids: ReadonlyArray<string>) => void
  readIndex: () => string[]
}

export function seedDashboards(io: StorageIo) {
  const savedAt = new Date().toISOString()

  for (const seed of SEEDS) {
    const stored: StoredDashboard = {
      id: seed.id,
      version: 1,
      savedAt,
      config: seed.config,
      revisions: [{ version: 1, savedAt, config: seed.config }],
    }

    io.write(`${STORAGE_KEY_PREFIX}${seed.id}`, JSON.stringify(stored))
  }

  io.writeIndex([...io.readIndex(), ...SEEDS.map((seed) => seed.id)])
  io.write(STORAGE_SEED_KEY, savedAt)
}

/** Seeding happens once per browser, so a reader's own dashboards are never overwritten. */
export function hasSeeded(read: (key: string) => string | null) {
  return read(STORAGE_SEED_KEY) !== null && read(STORAGE_INDEX_KEY) !== null
}
