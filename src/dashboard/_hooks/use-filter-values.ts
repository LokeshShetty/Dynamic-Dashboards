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
  /** Clears that report, for the reader who has read it. */
  dismissIgnored: () => void
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
   * ignored is still on screen, and the link describes what is actually in force.
   *
   * The report is held until the reader does something about it, and no longer: changing any
   * filter, resetting, or dismissing it clears it. A notice that outlives the problem it
   * describes is just another thing on screen that is not true.
   */
  const signature = ignored.map((entry) => `${entry.params.join('+')}=${entry.value}`).join('|')
  const [report, setReport] = useState({ signature, entries: ignored })

  // Captured during render, because the parameters are about to be taken out of the URL.
  if (signature !== '' && signature !== report.signature) setReport({ signature, entries: ignored })

  const clearReport = useCallback(() => {
    setReport((current) => ({ signature: current.signature, entries: [] }))
  }, [])

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

      clearReport()

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
    [clearReport, setListValues, setStrings],
  )

  const reset = useCallback(() => {
    clearReport()
    void setStrings(null)
    void setListValues(null)
  }, [clearReport, setListValues, setStrings])

  return {
    values,
    activeCount: countActiveFilters(filters, values),
    ignored: report.entries,
    dismissIgnored: clearReport,
    setValue,
    reset,
  }
}
