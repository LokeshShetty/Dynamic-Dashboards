import { useId } from 'react'

import type { DashboardFilter } from '../../_lib/config.schema'
import type { FilterValue } from '../../_lib/to-data-query'
import { FILTER_CONTROL_CLASS, FilterField } from './filter-field'

type Props = {
  filter: Extract<DashboardFilter, { kind: 'date-range' }>
  value: { from: string; to: string } | null
  onChange: (value: FilterValue) => void
}

export function DateRangeFilterControl({ filter, value, onChange }: Props) {
  const fromId = useId()
  const toId = useId()

  const change = (side: 'from' | 'to', next: string) => {
    const from = side === 'from' ? next : (value?.from ?? '')
    const to = side === 'to' ? next : (value?.to ?? '')

    onChange(from === '' && to === '' ? null : { from, to })
  }

  return (
    <FilterField label={filter.label} controlId={fromId} className="min-w-64">
      <div className="flex items-center gap-1">
        <input
          id={fromId}
          type="date"
          aria-label={`${filter.label} from`}
          className={FILTER_CONTROL_CLASS}
          value={value?.from ?? ''}
          onChange={(event) => change('from', event.target.value)}
        />
        <span className="text-fg-subtle text-xs">to</span>
        <input
          id={toId}
          type="date"
          aria-label={`${filter.label} to`}
          className={FILTER_CONTROL_CLASS}
          value={value?.to ?? ''}
          onChange={(event) => change('to', event.target.value)}
        />
      </div>
    </FilterField>
  )
}
