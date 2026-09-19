import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAppStore } from '@/lib/store'

import { dashboardStore } from '../_lib/dashboard-store'
import {
  describeStorageFailure,
  isRetryableStorageFailure,
  toStorageFailure,
} from '../_lib/storage-error'
import type { SaveInput, SaveOutcome } from '../_types'
import { dashboardQueryKey } from './use-dashboard-record'

/**
 * Saving is compare and swap: the save carries the version it started from, and storage refuses
 * it if that version has moved on. A refusal is an outcome, not an error, and it reaches the
 * caller as a conflict to resolve rather than as a failure to retry.
 *
 * A failed save leaves the draft exactly as it was, still dirty. Nothing is thrown away because
 * a write did not land.
 */
export function useSaveDashboard(dashboardId: string) {
  const queryClient = useQueryClient()
  const pushToast = useAppStore((state) => state.pushToast)
  const markDraftSaved = useAppStore((state) => state.markDraftSaved)

  const mutation = useMutation<SaveOutcome, Error, SaveInput>({
    mutationFn: (input) => dashboardStore.save(input),

    onSuccess: (outcome) => {
      if (outcome.kind === 'conflict') return

      queryClient.setQueryData(dashboardQueryKey(dashboardId), outcome.record)
      markDraftSaved()
      pushToast({
        tone: 'success',
        title: `Saved version ${outcome.record.version}`,
        description: `${outcome.record.revisionCount} revisions kept`,
      })
    },

    onError: (error, input) => {
      const failure = toStorageFailure(error)

      // A write is not retried automatically. It is offered, because the person who made the
      // change is the one who should decide whether to send it again.
      pushToast({
        tone: 'error',
        title: 'Save failed',
        description: `${describeStorageFailure(failure)}. Your changes are still here.`,
        ...(isRetryableStorageFailure(failure)
          ? { action: { label: 'Try saving again', onAction: () => mutation.mutate(input) } }
          : {}),
      })
    },
  })

  return mutation
}
