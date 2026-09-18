/**
 * The shape of saved state, and the interface over it.
 *
 * Everything here is asynchronous and takes an AbortSignal, and nothing in the interface
 * mentions localStorage. That is deliberate: a REST backed implementation is the same set of
 * methods with the same failure vocabulary, so replacing the backend does not reach the UI.
 */
export type DashboardRecord = {
  id: string
  /** The save counter. Compare and swap is done on this. */
  version: number
  savedAt: string
  /** The configuration exactly as it was saved, as text, so it is read back like any input. */
  config: string
  revisionCount: number
  oldestRevision: number | null
}

export type DashboardSummary = {
  id: string
  title: string | null
  version: number
  savedAt: string
}

export type RevisionRecord = {
  id: string
  version: number
  savedAt: string
  config: string
  /** Where this revision sits in the history that is still kept. */
  position: number
  total: number
}

export type SaveInput = {
  id: string
  config: string
  /** The version this edit started from. A save is refused if the stored version moved on. */
  expectedVersion: number
}

export type SaveOutcome =
  { kind: 'saved'; record: DashboardRecord } | { kind: 'conflict'; current: DashboardRecord }

export type StorageFailure =
  | { kind: 'unavailable'; message: string }
  | { kind: 'quota-exceeded'; message: string }
  | { kind: 'corrupt'; id: string; message: string }
  | { kind: 'not-found'; id: string }
  | { kind: 'request-failed'; message: string }
  | { kind: 'timeout'; timeoutMs: number }
  | { kind: 'aborted' }

export type StorageRequestOptions = { signal?: AbortSignal }

export type DashboardStore = {
  list: (options?: StorageRequestOptions) => Promise<DashboardSummary[]>
  read: (id: string, options?: StorageRequestOptions) => Promise<DashboardRecord>
  save: (input: SaveInput, options?: StorageRequestOptions) => Promise<SaveOutcome>
  create: (
    input: { id: string; title: string },
    options?: StorageRequestOptions,
  ) => Promise<DashboardRecord>
  readRevision: (
    id: string,
    version: number,
    options?: StorageRequestOptions,
  ) => Promise<RevisionRecord>
  resetToSeed: (options?: StorageRequestOptions) => Promise<void>
}
