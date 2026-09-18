import { useQuery } from '@tanstack/react-query'

import { MAX_DATA_ATTEMPTS, RETRY_BASE_DELAY_MS, RETRY_MAX_DELAY_MS } from '@/data/_constants'
import { fetchDatasetSchema } from '@/data/_lib/client'
import { describeDataError, isRetryableDataError, toDataError } from '@/data/_lib/data-error'
import { useAppStore } from '@/lib/store'
import type { DatasetField } from '@/types/data'

export type DatasetSchemaState =
  { kind: 'loading' } | { kind: 'ok'; fields: DatasetField[] } | { kind: 'error'; reason: string }

/**
 * The fields a widget can bind to, as the dataset reports them right now. The editor is a data
 * surface like everything else: this can be slow and it can fail, and when it fails the form
 * still lets a field name be typed rather than blocking the edit.
 */
export function useDatasetSchema(dataset: string): DatasetSchemaState {
  const epoch = useAppStore((state) => state.epoch)

  const result = useQuery({
    queryKey: ['dataset-schema', dataset, epoch],
    queryFn: ({ signal }) => fetchDatasetSchema(dataset, { signal }),
    retry: (failureCount, error) =>
      failureCount < MAX_DATA_ATTEMPTS - 1 && isRetryableDataError(toDataError(error)),
    retryDelay: (attempt) => Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS),
    staleTime: 60_000,
  })

  if (result.isError) {
    return { kind: 'error', reason: describeDataError(toDataError(result.error)) }
  }

  if (result.data === undefined) return { kind: 'loading' }

  return { kind: 'ok', fields: result.data.fields }
}
