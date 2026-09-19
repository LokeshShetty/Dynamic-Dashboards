import { useId, useState } from 'react'

import type { DashboardFilter } from '../../_lib/config.schema'
import type { FilterValue } from '../../_lib/to-data-query'
import { FILTER_CONTROL_CLASS, FilterField } from './filter-field'

type Props = {
  filter: Extract<DashboardFilter, { kind: 'date-range' }>
  value: { from: string; to: string } | null
  onChange: (value: FilterValue) => void
}

type Range = { from: string; to: string }

/**
 * A date input reports a value after every keystroke, so typing a year gives 0002, then 0020,
 * then 0202 before it gives 2026. Committing those would put a nonsense range in the URL and
 * re-render the input under the cursor, which is why the year could never be typed.
 *
 * So the control holds what is being typed and commits when the field is left or Enter is
 * pressed. The URL only ever sees a range someone finished writing.
 */
export function DateRangeFilterControl({ filter, value, onChange }: Props) {
  const fromId = useId()
  const toId = useId()

  const applied: Range = { from: value?.from ?? '', to: value?.to ?? '' }
  const [typed, setTyped] = useState<Range>(applied)
  const [lastApplied, setLastApplied] = useState<Range>(applied)

  // The URL can change without anyone typing: a reset, a shared link, the back button.
  if (applied.from !== lastApplied.from || applied.to !== lastApplied.to) {
    setLastApplied(applied)
    setTyped(applied)
  }

  const commit = (range: Range) => {
    if (range.from === applied.from && range.to === applied.to) return
    onChange(range.from === '' && range.to === '' ? null : range)
  }

  return (
    <FilterField label={filter.label} controlId={fromId} className="min-w-64">
      <div className="flex items-center gap-1">
        <input
          id={fromId}
          type="date"
          aria-label={`${filter.label} from`}
          className={FILTER_CONTROL_CLASS}
          value={typed.from}
          onChange={(event) => setTyped({ ...typed, from: event.target.value })}
          onBlur={() => commit(typed)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit(typed)
          }}
        />
        <span className="text-fg-subtle text-xs">to</span>
        <input
          id={toId}
          type="date"
          aria-label={`${filter.label} to`}
          className={FILTER_CONTROL_CLASS}
          value={typed.to}
          onChange={(event) => setTyped({ ...typed, to: event.target.value })}
          onBlur={() => commit(typed)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit(typed)
          }}
        />
      </div>
    </FilterField>
  )
}
