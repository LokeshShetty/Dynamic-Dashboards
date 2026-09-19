import type { DataResult, SkippedFilter } from '@/data/_types'

import type { WidgetState } from '../_types'

export type UnappliedFilter = { field: string; label: string; reason: string }

/**
 * A filter the data layer could not honour is the loudest kind of quiet failure: the widget
 * looks filtered, the bar says it is filtered, and the numbers cover everything. So the tile
 * says which filter did not apply, why, and that what it is showing is unfiltered.
 */
export function describeSkippedFilter(skipped: SkippedFilter, label: string): string {
  if (skipped.reason === 'field-missing') {
    return `filter "${label}" is not applicable: the field "${skipped.field}" is not in this dataset any more`
  }

  return `filter "${label}" is not applicable: "${skipped.field}" is ${skipped.actualType ?? 'a different type'} now, and this filter needs ${skipped.expected}`
}

export function unappliedFiltersOf(
  state: WidgetState<DataResult>,
  labels: Record<string, string>,
): UnappliedFilter[] {
  if (state.kind !== 'ok' && state.kind !== 'stale') return []

  return state.result.skippedFilters.map((skipped) => ({
    field: skipped.field,
    label: labels[skipped.field] ?? skipped.field,
    reason: describeSkippedFilter(skipped, labels[skipped.field] ?? skipped.field),
  }))
}

/**
 * Filters this widget opts out of. Two tiles under one filter bar showing different numbers is
 * confusing unless the one that ignored the bar says it did.
 */
export function ignoredFilterLabels(
  ignoredFilterIds: ReadonlyArray<string> | undefined,
  definitions: ReadonlyArray<{ id: string; label: string }>,
): string[] {
  if (!ignoredFilterIds || ignoredFilterIds.length === 0) return []

  return ignoredFilterIds.map((id) => definitions.find((filter) => filter.id === id)?.label ?? id)
}
