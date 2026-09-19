import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { Check, ChevronDown, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { useDistinctValues } from '../../_hooks/use-distinct-values'
import type { DashboardFilter } from '../../_lib/config.schema'
import type { FilterValue } from '../../_lib/to-data-query'
import { FILTER_CONTROL_CLASS, FilterField, FilterNote, FilterSkeleton } from './filter-field'

/** Above this many values the list gets its own search box. */
const SEARCHABLE_FROM = 8

type Props = {
  filter: Extract<DashboardFilter, { kind: 'multi-select' }>
  dataset: string
  value: string[] | null
  onChange: (value: FilterValue) => void
}

/**
 * A dropdown of checkboxes rather than a row of chips. Chips are readable at four values and
 * unusable at forty: they wrap over the whole bar and there is nothing to search. This keeps one
 * control of a fixed size whatever the field holds, says how many are selected, and filters the
 * list once there are enough values to be worth filtering.
 */
export function MultiSelectFilterControl({ filter, dataset, value, onChange }: Props) {
  const controlId = useId()
  const state = useDistinctValues(dataset, filter.field)
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = useMemo(() => new Set(value ?? []), [value])

  const labels = useMemo(
    () => new Map(filter.options.map((option) => [option.value, option.label])),
    [filter.options],
  )

  useEffect(() => {
    if (!isOpen) return

    const onPointerDown = (event: PointerEvent) => {
      const container = containerRef.current
      if (container && event.target instanceof Node && !container.contains(event.target)) {
        setIsOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

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
  const offered = [...missing, ...state.values]
  const matching = offered.filter((option) =>
    labelFor(option).toLowerCase().includes(search.trim().toLowerCase()),
  )

  function labelFor(option: string) {
    return labels.get(option) ?? option
  }

  const toggle = (option: string) => {
    const next = new Set(selected)
    if (next.has(option)) next.delete(option)
    else next.add(option)
    onChange(next.size === 0 ? null : [...next])
  }

  const summary = () => {
    if (selected.size === 0) return `All ${filter.label.toLowerCase()}`
    if (selected.size === 1) return labelFor([...selected][0] ?? '')
    return `${selected.size} selected`
  }

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
      <div ref={containerRef} className="relative">
        <button
          id={controlId}
          type="button"
          aria-expanded={isOpen}
          aria-haspopup="true"
          className={cn(FILTER_CONTROL_CLASS, 'flex items-center justify-between gap-2 text-left')}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span className={selected.size === 0 ? 'text-fg-muted truncate' : 'text-fg truncate'}>
            {summary()}
          </span>
          <ChevronDown aria-hidden="true" className="size-3 shrink-0" />
        </button>

        {isOpen ? (
          <div className="border-border bg-surface-raised absolute z-30 mt-1 flex w-64 flex-col gap-2 rounded-md border p-2 shadow-xl">
            {offered.length >= SEARCHABLE_FROM ? (
              <input
                type="search"
                aria-label={`Search ${filter.label.toLowerCase()} values`}
                placeholder="Search"
                className={FILTER_CONTROL_CLASS}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            ) : null}

            <ul className="flex max-h-56 flex-col overflow-auto">
              {matching.map((option) => (
                <li key={option}>
                  <label className="hover:bg-surface-muted flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs">
                    <input
                      type="checkbox"
                      className="accent-accent"
                      checked={selected.has(option)}
                      onChange={() => toggle(option)}
                    />
                    <span className="truncate">{labelFor(option)}</span>
                    {missing.includes(option) ? (
                      <span className="text-warning ml-auto shrink-0">not in data</span>
                    ) : null}
                    {selected.has(option) ? (
                      <Check aria-hidden="true" className="text-accent ml-auto size-3 shrink-0" />
                    ) : null}
                  </label>
                </li>
              ))}

              {matching.length === 0 ? (
                <li className="text-fg-muted px-1 py-2 text-xs">Nothing matches “{search}”</li>
              ) : null}
            </ul>

            <div className="border-border flex items-center justify-between border-t pt-2">
              <span className="text-fg-subtle text-xs tabular-nums">
                {selected.size} of {offered.length}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={selected.size === 0}
                onClick={() => onChange(null)}
              >
                <X aria-hidden="true" className="size-3" />
                Clear
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </FilterField>
  )
}
