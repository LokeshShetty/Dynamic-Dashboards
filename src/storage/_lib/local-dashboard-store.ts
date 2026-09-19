import { readChaos, takeCorruption, withTransport } from '@/data/_lib/transport'
import { isRecord } from '@/lib/guards'

import { MAX_REVISIONS_PER_DASHBOARD, STORAGE_INDEX_KEY, STORAGE_KEY_PREFIX } from '../_constants'
import type {
  DashboardRecord,
  DashboardStore,
  DashboardSummary,
  RevisionRecord,
  SaveOutcome,
  StorageRequestOptions,
} from '../_types'
import { publishSave } from './broadcast'
import { seedDashboards } from './seed'
import { fromTransportFailure, StorageRequestError } from './storage-error'
import { storedDashboardSchema, storedIndexSchema, type StoredDashboard } from './storage.schema'

/**
 * The store, over localStorage, behind the same transport as everything else: slow, sometimes
 * refused, cancellable. Saves are compare and swap on the version, so two tabs cannot silently
 * overwrite each other, and every save appends a revision.
 *
 * Nothing above this file knows it is localStorage. The same six methods over fetch would be a
 * drop in replacement.
 */
function keyFor(id: string) {
  return `${STORAGE_KEY_PREFIX}${id}`
}

/**
 * Storage is not always there, and not always what it claims to be: private modes, sandboxed
 * frames and embedded webviews all hand back something that looks like storage and is not. The
 * shape is checked rather than assumed, so the failure arrives as a reason the reader can see
 * instead of a TypeError somewhere deeper.
 */
function storage(): Storage {
  try {
    const candidate = globalThis.localStorage

    if (
      !candidate ||
      typeof candidate.getItem !== 'function' ||
      typeof candidate.setItem !== 'function' ||
      typeof candidate.removeItem !== 'function'
    ) {
      throw new Error('this context does not provide a usable localStorage')
    }

    return candidate
  } catch (error) {
    throw new StorageRequestError({
      kind: 'unavailable',
      message: error instanceof Error ? error.message : 'localStorage cannot be reached',
    })
  }
}

function readIndex(): string[] {
  const raw = storage().getItem(STORAGE_INDEX_KEY)
  if (raw === null) return []

  try {
    const parsed = storedIndexSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

function writeIndex(ids: ReadonlyArray<string>) {
  write(STORAGE_INDEX_KEY, JSON.stringify([...new Set(ids)]))
}

function write(key: string, value: string) {
  try {
    storage().setItem(key, value)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'storage refused the write'
    const isQuota = /quota|exceeded|full/i.test(message)

    throw new StorageRequestError(
      isQuota ? { kind: 'quota-exceeded', message } : { kind: 'unavailable', message },
    )
  }
}

function readStored(id: string): StoredDashboard {
  const raw = storage().getItem(keyFor(id))
  if (raw === null) throw new StorageRequestError({ kind: 'not-found', id })

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new StorageRequestError({
      kind: 'corrupt',
      id,
      message: error instanceof Error ? error.message : 'it is not JSON',
    })
  }

  const validated = storedDashboardSchema.safeParse(parsed)
  if (!validated.success) {
    throw new StorageRequestError({
      kind: 'corrupt',
      id,
      message: validated.error.issues[0]?.message ?? 'it does not match the stored record format',
    })
  }

  return validated.data
}

function toRecord(stored: StoredDashboard): DashboardRecord {
  return {
    id: stored.id,
    version: stored.version,
    savedAt: stored.savedAt,
    config: stored.config,
    revisionCount: stored.revisions.length,
    oldestRevision: stored.revisions[0]?.version ?? null,
  }
}

function titleOf(config: string): string | null {
  try {
    const parsed: unknown = JSON.parse(config)
    return isRecord(parsed) && typeof parsed.title === 'string' ? parsed.title : null
  } catch {
    return null
  }
}

function run<T>(options: StorageRequestOptions, event: string, work: () => T): Promise<T> {
  return withTransport(options, readChaos(), event, work, fromTransportFailure)
}

export const localDashboardStore: DashboardStore = {
  list: (options = {}) =>
    run(options, 'storage.list', () =>
      readIndex().flatMap<DashboardSummary>((id) => {
        try {
          const stored = readStored(id)
          return [
            {
              id,
              title: titleOf(stored.config),
              version: stored.version,
              savedAt: stored.savedAt,
            },
          ]
        } catch {
          // A single unreadable record does not make the list unreadable.
          return [{ id, title: null, version: 0, savedAt: '' }]
        }
      }),
    ),

  read: (id, options = {}) =>
    run(options, 'storage.read', () => {
      const stored = readStored(id)

      // Corruption applies to what comes back, so the loader meets it as a reader would.
      if (takeCorruption()) {
        return toRecord({
          ...stored,
          config: stored.config.slice(0, Math.floor(stored.config.length / 2)),
        })
      }

      return toRecord(stored)
    }),

  save: ({ id, config, expectedVersion }, options = {}) =>
    run(options, 'storage.save', (): SaveOutcome => {
      const stored = readStored(id)

      if (stored.version !== expectedVersion) {
        return { kind: 'conflict', current: toRecord(stored) }
      }

      const version = stored.version + 1
      const savedAt = new Date().toISOString()
      const revisions = [...stored.revisions, { version, savedAt, config }].slice(
        -MAX_REVISIONS_PER_DASHBOARD,
      )

      const next: StoredDashboard = { id, version, savedAt, config, revisions }
      write(keyFor(id), JSON.stringify(next))

      /**
       * localStorage has no compare and swap of its own: the read above and the write here are
       * two operations, and two tabs can pass the version check at the same moment and both
       * write. So the write is read back. If what is stored is not what was just written, the
       * other tab won the race, and this save is reported as the conflict it is rather than as
       * a success that quietly lost the reader's work.
       *
       * This narrows the window rather than closing it. Closing it needs a backend, and that is
       * written up in SELF_REVIEW.md.
       */
      const landed = readStored(id)

      if (landed.version !== version || landed.savedAt !== savedAt) {
        return { kind: 'conflict', current: toRecord(landed) }
      }

      publishSave({ dashboardId: id, version, savedAt })

      return { kind: 'saved', record: toRecord(next) }
    }),

  create: ({ id, title }, options = {}) =>
    run(options, 'storage.create', () => {
      const config = JSON.stringify(emptyDashboard(id, title), null, 2)
      const savedAt = new Date().toISOString()
      const stored: StoredDashboard = {
        id,
        version: 1,
        savedAt,
        config,
        revisions: [{ version: 1, savedAt, config }],
      }

      write(keyFor(id), JSON.stringify(stored))
      writeIndex([...readIndex(), id])
      publishSave({ dashboardId: id, version: 1, savedAt })

      return toRecord(stored)
    }),

  readRevision: (id, version, options = {}) =>
    run(options, 'storage.revision', (): RevisionRecord => {
      const stored = readStored(id)
      const position = stored.revisions.findIndex((revision) => revision.version === version)
      const revision = stored.revisions[position]

      if (!revision) {
        throw new StorageRequestError({
          kind: 'not-found',
          id: `${id}@${version}`,
        })
      }

      return {
        id,
        version: revision.version,
        savedAt: revision.savedAt,
        config: revision.config,
        position: position + 1,
        total: stored.revisions.length,
      }
    }),

  resetToSeed: (options = {}) =>
    run(options, 'storage.reset', () => {
      for (const id of readIndex()) storage().removeItem(keyFor(id))
      writeIndex([])
      seedDashboards({ write, writeIndex, readIndex })
    }),
}

function emptyDashboard(id: string, title: string) {
  return {
    schemaVersion: 3,
    id,
    title,
    version: 1,
    updatedAt: new Date().toISOString(),
    dataset: 'claims',
    layout: { columns: 12 },
    filters: [],
    widgets: [],
  }
}
