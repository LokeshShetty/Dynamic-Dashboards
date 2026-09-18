import { useQuery } from '@tanstack/react-query'

import { MAX_DATA_ATTEMPTS, RETRY_BASE_DELAY_MS, RETRY_MAX_DELAY_MS } from '@/data/_constants'

import { dashboardStore } from '../_lib/dashboard-store'
import {
  describeStorageFailure,
  isRetryableStorageFailure,
  toStorageFailure,
} from '../_lib/storage-error'
import type { DashboardRecord } from '../_types'

export type DashboardRecordState =
  | { kind: 'loading' }
  | { kind: 'ok'; record: DashboardRecord }
  | { kind: 'not-found'; id: string }
  | { kind: 'corrupt'; reason: string }
  | { kind: 'error'; reason: string }

export function dashboardQueryKey(id: string) {
  return ['dashboard', id] as const
}

/** Reading saved state is a request like any other: slow, refusable, and validated on arrival. */
export function useDashboardRecord(id: string) {
  const query = useQuery({
    queryKey: dashboardQueryKey(id),
    queryFn: ({ signal }) => dashboardStore.read(id, { signal }),
    retry: (failureCount, error) =>
      failureCount < MAX_DATA_ATTEMPTS - 1 && isRetryableStorageFailure(toStorageFailure(error)),
    retryDelay: (attempt) => Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS),
  })

  const state = ((): DashboardRecordState => {
    if (query.data !== undefined) return { kind: 'ok', record: query.data }
    if (!query.isError) return { kind: 'loading' }

    const failure = toStorageFailure(query.error)

    if (failure.kind === 'not-found') return { kind: 'not-found', id: failure.id }
    if (failure.kind === 'corrupt') return { kind: 'corrupt', reason: failure.message }

    return { kind: 'error', reason: describeStorageFailure(failure) }
  })()

  return { state, refetch: query.refetch, isFetching: query.isFetching }
}
