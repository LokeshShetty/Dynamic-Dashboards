import { useQuery } from '@tanstack/react-query'

import { MAX_DATA_ATTEMPTS, RETRY_BASE_DELAY_MS, RETRY_MAX_DELAY_MS } from '@/data/_constants'
import { fetchDistinctValues } from '@/data/_lib/client'
import { describeDataError, isRetryableDataError, toDataError } from '@/data/_lib/data-error'
import { useAppStore } from '@/lib/store'

export type DistinctValuesState =
  | { kind: 'loading' }
  | { kind: 'ok'; values: string[]; truncated: boolean }
  | { kind: 'error'; reason: string }

/**
 * The values a control can offer, fetched through the same client as everything else. The
 * filter bar is a data surface too: it can be slow, it can fail, and a renamed field takes its
 * options away exactly as it takes a widget's numbers away.
 */
export function useDistinctValues(dataset: string, field: string): DistinctValuesState {
  const epoch = useAppStore((state) => state.epoch)

  const result = useQuery({
    queryKey: ['distinct-values', dataset, field, epoch],
    queryFn: ({ signal }) => fetchDistinctValues(dataset, field, { signal }),
    retry: (failureCount, error) =>
      failureCount < MAX_DATA_ATTEMPTS - 1 && isRetryableDataError(toDataError(error)),
    retryDelay: (attempt) => Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS),
    staleTime: 60_000,
  })

  if (result.isError) {
    return { kind: 'error', reason: describeDataError(toDataError(result.error)) }
  }

  if (result.data === undefined) return { kind: 'loading' }

  return { kind: 'ok', values: result.data.values, truncated: result.data.truncated }
}
