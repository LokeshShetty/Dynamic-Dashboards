import { MAX_DATA_ATTEMPTS } from '@/data/_constants'
import { describeDataError, isBindingDataError } from '@/data/_lib/data-error'
import type { DataError, DataResult } from '@/data/_types'

import type { WidgetSlot, WidgetState } from '../_types'
import { summarizeIssues } from './config-issues'

/**
 * A widget that failed validation is still a widget on the grid. It takes its place, says
 * what is wrong with it, and leaves the others alone.
 */
export function slotToWidgetState(slot: WidgetSlot): WidgetState | null {
  switch (slot.kind) {
    case 'valid':
      return null

    case 'invalid':
      return { kind: 'invalid', reason: summarizeIssues(slot.issues), issues: slot.issues }

    case 'duplicate-id':
      return {
        kind: 'invalid',
        reason: `duplicate widget id "${slot.id}", already used by the widget at position ${slot.firstIndex + 1}`,
        issues: [{ path: 'id', message: 'a widget id has to be unique within a dashboard' }],
      }

    case 'overlapping-layout':
      return {
        kind: 'invalid',
        reason: `this widget sits on top of "${slot.overlapsId}"`,
        issues: [
          { path: 'layout', message: 'two widgets cannot occupy the same cell of the grid' },
        ],
      }
  }
}

export function dataErrorToWidgetState(
  error: DataError,
  attempt: number,
  isRefreshing: boolean,
): WidgetState {
  if (isBindingDataError(error)) {
    return { kind: 'unresolvable', reason: describeDataError(error) }
  }

  return {
    kind: 'error',
    reason: describeDataError(error),
    attempt,
    maxAttempts: MAX_DATA_ATTEMPTS,
    isRefreshing,
  }
}

/**
 * A presentation that cannot be honoured is a binding problem, not a rendering detail: a
 * currency format over a field with no money in it has no right answer, so the widget says so
 * instead of picking one.
 */
export function withPresentationCheck<TResult extends DataResult>(
  state: WidgetState<TResult>,
  check: (result: TResult) => string | null,
): WidgetState<TResult> {
  if (state.kind !== 'ok' && state.kind !== 'stale') return state

  const reason = check(state.result)
  if (reason === null) return state

  return { kind: 'unresolvable', reason }
}
