import { useId, useMemo } from 'react'

import { useDistinctValues } from '../../_hooks/use-distinct-values'
import type { DashboardFilter } from '../../_lib/config.schema'
import type { FilterValue } from '../../_lib/to-data-query'
import { FILTER_CONTROL_CLASS, FilterField, FilterNote, FilterSkeleton } from './filter-field'

type Props = {
  filter: Extract<DashboardFilter, { kind: 'select' }>
  dataset: string
  value: string | null
  onChange: (value: FilterValue) => void
}

/**
 * Options come from the values the field actually holds right now, not from the list the
 * configuration was written against. A value that is selected but no longer in the data stays
 * selected and says so: dropping it would quietly widen the reader's query.
 */
export function SelectFilterControl({ filter, dataset, value, onChange }: Props) {
  const controlId = useId()
  const state = useDistinctValues(dataset, filter.field)

  const labels = useMemo(
    () => new Map(filter.options.map((option) => [option.value, option.label])),
    [filter.options],
  )

  if (state.kind === 'loading') {
    return (
      <FilterField label={filter.label} controlId={controlId}>
        <FilterSkeleton />
      </FilterField>
    )
  }

  if (state.kind === 'error') {
    return (
      <FilterField
        label={filter.label}
        controlId={controlId}
        note={
          <FilterNote tone="warning">
            Cannot list values: {state.reason}. Type one instead.
          </FilterNote>
        }
      >
        <input
          id={controlId}
          className={FILTER_CONTROL_CLASS}
          defaultValue={value ?? ''}
          placeholder={`Any ${filter.label.toLowerCase()}`}
          onBlur={(event) => onChange(event.target.value === '' ? null : event.target.value)}
        />
      </FilterField>
    )
  }

  const missing = value !== null && !state.values.includes(value)
  const options = missing ? [value, ...state.values] : state.values

  const note = () => {
    if (missing) {
      return <FilterNote tone="warning">“{value}” is not present in current data</FilterNote>
    }
    if (state.truncated) {
      return <FilterNote tone="muted">showing the first {state.values.length} values</FilterNote>
    }
    return undefined
  }

  return (
    <FilterField label={filter.label} controlId={controlId} note={note()}>
      <select
        id={controlId}
        className={FILTER_CONTROL_CLASS}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels.get(option) ?? option}
            {option === value && missing ? ' (not in current data)' : ''}
          </option>
        ))}
      </select>
    </FilterField>
  )
}
