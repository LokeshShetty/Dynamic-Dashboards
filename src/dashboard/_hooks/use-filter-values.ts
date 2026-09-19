import { useCallback, useEffect, useMemo, useState } from 'react'

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

  /**
   * A parameter that was ignored stays in the address bar saying one thing while the dashboard
   * shows another, and a reader who copies that link passes the confusion on. So it is removed
   * once it has been reported, and the report is kept here rather than in the URL: what was
   * ignored is still on screen, and the link now describes what is actually in force.
   */
  const [reported, setReported] = useState<IgnoredParam[]>(ignored)

  // Remembered during render, because the parameter is about to be taken out of the URL and the
  // reader still needs to be told what happened to it.
  if (ignored.length > 0 && reported.length === 0) setReported(ignored)

  useEffect(() => {
    if (ignored.length === 0) return

    const names = ignored.flatMap((entry) => entry.params)
    const stringPatch: Record<string, null> = {}
    const listPatch: Record<string, null> = {}

    for (const name of names) {
      if (name in lists) listPatch[name] = null
      else stringPatch[name] = null
    }

    if (Object.keys(stringPatch).length > 0) void setStrings(stringPatch)
    if (Object.keys(listPatch).length > 0) void setListValues(listPatch)
  }, [ignored, lists, setListValues, setStrings])

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
    ignored: ignored.length > 0 ? ignored : reported,
    setValue,
    reset,
  }
}
