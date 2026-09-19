import { useEffect, useId, useState } from 'react'

import { useDebouncedValue } from '@/hooks/use-debounced-value'

import type { DashboardFilter } from '../../_lib/config.schema'
import type { FilterValue } from '../../_lib/to-data-query'
import { FILTER_CONTROL_CLASS, FilterField } from './filter-field'

const DEBOUNCE_MS = 250

type Props = {
  filter: Extract<DashboardFilter, { kind: 'search' }>
  value: string | null
  onChange: (value: FilterValue) => void
}

/**
 * Typing is debounced before it becomes a filter value, not just before it reaches the URL:
 * every keystroke that reached the query key would be a request per character, and every one of
 * them would cancel the last. The field itself stays immediate, so it never feels laggy.
 */
export function SearchFilterControl({ filter, value, onChange }: Props) {
  const controlId = useId()
  const applied = value ?? ''

  const [typed, setTyped] = useState(applied)
  const [lastApplied, setLastApplied] = useState(applied)
  const settled = useDebouncedValue(typed, DEBOUNCE_MS)

  // The URL can change without the reader typing: a reset, a shared link, the back button.
  if (applied !== lastApplied) {
    setLastApplied(applied)
    setTyped(applied)
  }

  useEffect(() => {
    if (settled === applied) return
    onChange(settled === '' ? null : settled)
  }, [applied, onChange, settled])

  return (
    <FilterField label={filter.label} controlId={controlId}>
      <input
        id={controlId}
        type="search"
        className={FILTER_CONTROL_CLASS}
        placeholder={filter.placeholder ?? `Search ${filter.label.toLowerCase()}`}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
      />
    </FilterField>
  )
}
