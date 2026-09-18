import { useId, useMemo } from 'react'

import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

import { useDistinctValues } from '../../_hooks/use-distinct-values'
import type { DashboardFilter } from '../../_lib/config.schema'
import type { FilterValue } from '../../_lib/to-data-query'
import { FILTER_CONTROL_CLASS, FilterField, FilterNote, FilterSkeleton } from './filter-field'

const MAX_CHIPS = 12

type Props = {
  filter: Extract<DashboardFilter, { kind: 'multi-select' }>
  dataset: string
  value: string[] | null
  onChange: (value: FilterValue) => void
}

export function MultiSelectFilterControl({ filter, dataset, value, onChange }: Props) {
  const controlId = useId()
  const state = useDistinctValues(dataset, filter.field)
  const selected = useMemo(() => new Set(value ?? []), [value])

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
          className={FILTER_CONTROL_CLASS}
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

  const missing = (value ?? []).filter((entry) => !state.values.includes(entry))
  const offered = [...missing, ...state.values.slice(0, MAX_CHIPS)]

  const note = () => {
    if (missing.length > 0) {
      return (
        <FilterNote tone="warning">
          {missing.map((entry) => `“${entry}”`).join(', ')} not present in current data
        </FilterNote>
      )
    }
    if (state.values.length > MAX_CHIPS) {
      return (
        <FilterNote tone="muted">
          showing {MAX_CHIPS} of {state.values.length} values
        </FilterNote>
      )
    }
    return undefined
  }

  const toggle = (option: string) => {
    const next = new Set(selected)
    if (next.has(option)) next.delete(option)
    else next.add(option)
    onChange(next.size === 0 ? null : [...next])
  }

  return (
    <FilterField
      label={filter.label}
      controlId={controlId}
      labelling="group"
      className="min-w-64"
      note={note()}
    >
      <div className="flex flex-wrap gap-1">
        {offered.map((option) => {
          const isSelected = selected.has(option)
          const isMissing = missing.includes(option)

          return (
            <button
              key={option}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggle(option)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs',
                isSelected
                  ? 'border-accent bg-accent text-accent-fg font-medium'
                  : 'border-border bg-surface-raised text-fg-muted hover:bg-surface-muted',
                isMissing ? 'border-warning' : '',
              )}
            >
              {isSelected ? <Check aria-hidden="true" className="size-3" /> : null}
              {labels.get(option) ?? option}
              {isMissing ? ' *' : ''}
            </button>
          )
        })}
      </div>
    </FilterField>
  )
}
