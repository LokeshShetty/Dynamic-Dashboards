import type { DataFilter, DataQuery } from '@/data/_types'

import type { DashboardFilter, Widget } from './config.schema'

/**
 * Turns a validated widget and the filter values in force into a data query. Pure, so the
 * query key derived from it is stable: the same widget under the same filters always produces
 * the same key, and a different filter always produces a different one.
 */
export type FilterValue = string | string[] | { from: string; to: string } | null

export type FilterValues = Record<string, FilterValue>

export function toDataFilters(
  filters: ReadonlyArray<DashboardFilter>,
  values: FilterValues,
  ignoredFilterIds: ReadonlyArray<string> = [],
): DataFilter[] {
  const applied: DataFilter[] = []

  for (const filter of filters) {
    if (ignoredFilterIds.includes(filter.id)) continue

    const value = values[filter.id] ?? null
    if (value === null) continue

    switch (filter.kind) {
      case 'select':
        if (typeof value === 'string' && value !== '') {
          applied.push({ kind: 'equals', field: filter.field, value })
        }
        break

      case 'multi-select':
        if (Array.isArray(value) && value.length > 0) {
          applied.push({ kind: 'in', field: filter.field, values: value })
        }
        break

      case 'date-range':
        if (typeof value === 'object' && !Array.isArray(value)) {
          applied.push({ kind: 'date-range', field: filter.field, from: value.from, to: value.to })
        }
        break

      case 'search':
        if (typeof value === 'string' && value.trim() !== '') {
          applied.push({ kind: 'contains', field: filter.field, value: value.trim() })
        }
        break
    }
  }

  return applied
}

/** Text widgets have no binding, so they never ask the data layer anything. */
export function toDataQuery(
  widget: Widget,
  dataset: string,
  filters: DataFilter[],
): DataQuery | null {
  switch (widget.kind) {
    case 'metric':
      return {
        dataset,
        filters,
        select: { kind: 'aggregate', field: widget.value.field, aggregate: widget.value.aggregate },
      }

    case 'table':
      return {
        dataset,
        filters,
        select: {
          kind: 'rows',
          fields: widget.columns.map((column) => column.field),
          sort: widget.sort ?? null,
          limit: widget.pageSize,
        },
      }

    case 'chart':
      return {
        dataset,
        filters,
        select: {
          kind: 'series',
          x: { field: widget.x.field, bucket: widget.x.bucket ?? null },
          series: widget.series.map((series, index) => ({
            key: `s${index}`,
            field: series.field,
            aggregate: series.aggregate,
          })),
        },
      }

    case 'text':
      return null
  }
}
