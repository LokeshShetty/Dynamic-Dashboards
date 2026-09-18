import { useQuery } from '@tanstack/react-query'

import { MAX_DATA_ATTEMPTS, RETRY_BASE_DELAY_MS, RETRY_MAX_DELAY_MS } from '@/data/_constants'
import { runDataQuery } from '@/data/_lib/client'
import { isBindingDataError, isRetryableDataError, toDataError } from '@/data/_lib/data-error'
import type { DataQuery, DataResult } from '@/data/_types'
import { useAppStore } from '@/lib/store'

import type { WidgetDataState } from '../_types'

type UseWidgetDataOptions = {
  dashboardId: string
  widgetId: string
  query: DataQuery
}

/**
 * One widget's data, as a state the frame can render.
 *
 * The query key carries everything that can change the answer: which dashboard, which widget,
 * the binding and filters (both inside the query), and the chaos epoch, which moves whenever
 * the world itself changes. That is what keeps a slow answer to an old question from landing
 * on screen after the question changed: it is written to the key it was asked under, and that
 * key is no longer the one being rendered.
 */
export function useWidgetData({
  dashboardId,
  widgetId,
  query,
}: UseWidgetDataOptions): WidgetDataState {
  const epoch = useAppStore((state) => state.epoch)

  const result = useQuery({
    queryKey: ['widget-data', dashboardId, widgetId, epoch, query],
    queryFn: ({ signal }) => runDataQuery(query, { signal }),
    retry: (failureCount, error) =>
      failureCount < MAX_DATA_ATTEMPTS - 1 && isRetryableDataError(toDataError(error)),
    retryDelay: (attempt) => Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS),
  })

  const isRefreshing = result.isFetching && result.data !== undefined

  if (result.data !== undefined && result.isError) {
    return {
      kind: 'stale',
      result: result.data,
      fetchedAt: result.dataUpdatedAt,
      failure: toDataError(result.error),
      failedAt: result.errorUpdatedAt,
      isRefreshing,
    }
  }

  if (result.isError) {
    const error = toDataError(result.error)

    if (isBindingDataError(error)) return { kind: 'unresolvable-binding', error }

    return {
      kind: 'error',
      error,
      attempt: result.failureCount,
      maxAttempts: MAX_DATA_ATTEMPTS,
    }
  }

  if (result.data !== undefined) {
    if (isEmptyResult(result.data)) {
      return { kind: 'empty', fetchedAt: result.dataUpdatedAt, isRefreshing }
    }

    return { kind: 'ok', result: result.data, fetchedAt: result.dataUpdatedAt, isRefreshing }
  }

  return {
    kind: 'loading',
    attempt: result.failureCount + 1,
    maxAttempts: MAX_DATA_ATTEMPTS,
  }
}

/**
 * Nothing to show is its own state. A metric whose value is null is empty rather than zero,
 * because rendering it as zero would be the clearest possible way to show something untrue.
 */
export function isEmptyResult(result: DataResult) {
  switch (result.kind) {
    case 'value':
      return result.matchedRows === 0 || result.value === null
    case 'rows':
      return result.rows.length === 0
    case 'series':
      return result.points.length === 0
  }
}
