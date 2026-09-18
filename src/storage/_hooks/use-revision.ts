import { useQuery } from '@tanstack/react-query'
import { createParser, useQueryState } from 'nuqs'

import { MAX_DATA_ATTEMPTS, RETRY_BASE_DELAY_MS, RETRY_MAX_DELAY_MS } from '@/data/_constants'

import { dashboardStore } from '../_lib/dashboard-store'
import {
  describeStorageFailure,
  isRetryableStorageFailure,
  toStorageFailure,
} from '../_lib/storage-error'
import type { RevisionRecord } from '../_types'

const parseRevision = createParser({
  parse: (raw) => {
    const value = Number(raw)
    return Number.isInteger(value) && value > 0 ? value : null
  },
  serialize: (value: number) => String(value),
})

/** ?rev=4 opens that revision, read only. History is never rewritten, only appended to. */
export function useRevisionParam() {
  const [revision, setRevision] = useQueryState('rev', parseRevision)

  return {
    revision,
    viewRevision: (version: number) => {
      void setRevision(version)
    },
    leaveRevision: () => {
      void setRevision(null)
    },
  }
}

export type RevisionState =
  { kind: 'loading' } | { kind: 'ok'; revision: RevisionRecord } | { kind: 'error'; reason: string }

export function useRevision(dashboardId: string, version: number | null): RevisionState {
  const query = useQuery({
    queryKey: ['dashboard-revision', dashboardId, version],
    queryFn: ({ signal }) => dashboardStore.readRevision(dashboardId, version ?? 0, { signal }),
    enabled: version !== null,
    retry: (failureCount, error) =>
      failureCount < MAX_DATA_ATTEMPTS - 1 && isRetryableStorageFailure(toStorageFailure(error)),
    retryDelay: (attempt) => Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS),
  })

  if (query.isError) {
    return { kind: 'error', reason: describeStorageFailure(toStorageFailure(query.error)) }
  }

  if (query.data === undefined) return { kind: 'loading' }

  return { kind: 'ok', revision: query.data }
}
