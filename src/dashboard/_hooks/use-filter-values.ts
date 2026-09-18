import { useCallback, useMemo } from 'react'

import { useQueryStates } from 'nuqs'
import { useSearchParams } from 'react-router'

import type { DashboardFilter } from '../_lib/config.schema'
import {
  buildFilterParsers,
  countActiveFilters,
  paramNamesFor,
  toFilterUrlState,
  type IgnoredParam,
} from '../_lib/filter-params'
import type { FilterValue, FilterValues } from '../_lib/to-data-query'

export type UseFilterValuesResult = {
  values: FilterValues
  activeCount: number
  /** Parameters that did not survive validation, named so the bar can say what it ignored. */
  ignored: IgnoredParam[]
  setValue: (filter: DashboardFilter, value: FilterValue) => void
  reset: () => void
}

/**
 * The filter values in force, read from the URL and written back to it. The configuration
 * supplies the defaults; the URL decides the rest; nothing lives in component state, so a
 * link carries the dashboard exactly as the sender was looking at it.
 */
export function useFilterValues(filters: ReadonlyArray<DashboardFilter>): UseFilterValuesResult {
  const { parsers, lists } = useMemo(() => buildFilterParsers(filters), [filters])

  const [strings, setStrings] = useQueryStates(parsers)
  const [listValues, setListValues] = useQueryStates(lists)
  const [rawParams] = useSearchParams()

  const { values, ignored } = useMemo(
    () => toFilterUrlState(filters, strings, listValues, rawParams),
    [filters, strings, listValues, rawParams],
  )

  const setValue = useCallback(
    (filter: DashboardFilter, value: FilterValue) => {
      const [first, second] = paramNamesFor(filter)
      if (first === undefined) return

      if (filter.kind === 'multi-select') {
        void setListValues({ [first]: Array.isArray(value) && value.length > 0 ? value : null })
        return
      }

      if (filter.kind === 'date-range') {
        const range =
          value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null
        void setStrings({
          [first]: range?.from ?? null,
          ...(second === undefined ? {} : { [second]: range?.to ?? null }),
        })
        return
      }

      void setStrings({ [first]: typeof value === 'string' && value !== '' ? value : null })
    },
    [setListValues, setStrings],
  )

  const reset = useCallback(() => {
    void setStrings(null)
    void setListValues(null)
  }, [setListValues, setStrings])

  return {
    values,
    activeCount: countActiveFilters(filters, values),
    ignored,
    setValue,
    reset,
  }
}
