import { useEffect, useId, useState } from 'react'

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
 * every keystroke that reached the query key would be a request per character, and every one
 * of them would cancel the last.
 */
export function SearchFilterControl({ filter, value, onChange }: Props) {
  const controlId = useId()
  const [typed, setTyped] = useState(value ?? '')
  const [lastValue, setLastValue] = useState(value)

  // The URL can change without the reader typing: a reset, a shared link, the back button.
  // Adjusting during render is React's own pattern for this, and avoids a second pass.
  if (value !== lastValue) {
    setLastValue(value)
    setTyped(value ?? '')
  }

  useEffect(() => {
    const current = value ?? ''
    if (typed === current) return

    const timer = setTimeout(() => onChange(typed === '' ? null : typed), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [typed, value, onChange])

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
