import { useId, useMemo } from 'react'

import { SearchableSelect } from '@/components/ui/searchable-select'
import { CONTROL_CLASS } from '@/constants/ui'
import type { SelectOption } from '@/types/ui'

import { useDistinctValues } from '../../_hooks/use-distinct-values'
import type { DashboardFilter } from '../../_lib/config.schema'
import type { FilterValue } from '../../_lib/to-data-query'
import { FilterField, FilterNote, FilterSkeleton } from './filter-field'

type Props = {
  filter: Extract<DashboardFilter, { kind: 'multi-select' }>
  dataset: string
  value: string[] | null
  onChange: (value: FilterValue) => void
}

/**
 * Several values from a list that comes out of the data, so it is as long as the data says. A
 * value that is selected but no longer present stays selected and is marked: dropping it would
 * quietly widen the reader's query.
 */
export function MultiSelectFilterControl({ filter, dataset, value, onChange }: Props) {
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
            Cannot list values: {state.reason}. Type them comma separated instead.
          </FilterNote>
        }
      >
        <input
          id={controlId}
          className={CONTROL_CLASS}
          defaultValue={(value ?? []).join(',')}
          placeholder={`Any ${filter.label.toLowerCase()}`}
          onBlur={(event) => {
            const parts = event.target.value
              .split(',')
              .map((part) => part.trim())
              .filter((part) => part !== '')
            onChange(parts.length > 0 ? parts : null)
          }}
        />
      </FilterField>
    )
  }

  const selected = value ?? []
  const missing = selected.filter((entry) => !state.values.includes(entry))

  const options: SelectOption[] = [...missing, ...state.values].map((option) => ({
    value: option,
    label: labels.get(option) ?? option,
    isMissing: missing.includes(option),
  }))

  const note = () => {
    if (missing.length > 0) {
      return (
        <FilterNote tone="warning">
          {missing.map((entry) => `“${entry}”`).join(', ')} not present in current data
        </FilterNote>
      )
    }
    if (state.truncated) {
      return <FilterNote tone="muted">showing the first {state.values.length} values</FilterNote>
    }
    return undefined
  }

  return (
    <FilterField label={filter.label} controlId={controlId} note={note()}>
      <SearchableSelect
        id={controlId}
        label={filter.label}
        options={options}
        emptyLabel={`All ${filter.label.toLowerCase()}`}
        selection={{
          mode: 'multiple',
          values: selected,
          onChange: (values) => onChange(values.length > 0 ? values : null),
        }}
      />
    </FilterField>
  )
}
