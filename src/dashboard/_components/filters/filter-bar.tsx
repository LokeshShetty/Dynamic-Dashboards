import { Filter, RotateCcw, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { DashboardFilter } from '../../_lib/config.schema'
import type { IgnoredParam } from '../../_lib/filter-params'
import type { FilterValue, FilterValues } from '../../_lib/to-data-query'
import type { DroppedFilter } from '../../_types'
import { FilterControl } from './filter-control'

type Props = {
  filters: ReadonlyArray<DashboardFilter>
  /** Filter definitions that did not validate, named so the reader knows what is missing. */
  dropped: ReadonlyArray<DroppedFilter>
  dataset: string
  values: FilterValues
  activeCount: number
  ignored: IgnoredParam[]
  onChange: (filter: DashboardFilter, value: FilterValue) => void
  onReset: () => void
  onDismissIgnored: () => void
}

export function FilterBar({
  filters,
  dropped,
  dataset,
  values,
  activeCount,
  ignored,
  onChange,
  onReset,
  onDismissIgnored,
}: Props) {
  if (filters.length === 0 && dropped.length === 0) return null

  return (
    <section
      aria-label="Dashboard filters"
      className="border-border bg-surface-raised flex flex-col gap-3 rounded-lg border p-3"
    >
      <div className="flex flex-wrap items-end gap-3">
        {filters.map((filter) => (
          <FilterControl
            key={filter.id}
            filter={filter}
            dataset={dataset}
            value={values[filter.id] ?? null}
            onChange={(value) => onChange(filter, value)}
          />
        ))}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-fg-muted inline-flex items-center gap-1 text-xs">
            <Filter aria-hidden="true" className="size-3" />
            {activeCount === 0
              ? 'no filters changed'
              : `${activeCount} filter${activeCount === 1 ? '' : 's'} active`}
          </span>
          <Button size="sm" onClick={onReset} disabled={activeCount === 0}>
            <RotateCcw aria-hidden="true" className="size-3" />
            Reset to defaults
          </Button>
        </div>
      </div>

      {dropped.length > 0 ? (
        <output className="border-warning bg-warning-surface text-fg flex items-start gap-2 rounded-md border p-2 text-xs">
          <ul className="flex flex-1 flex-col gap-1">
            {dropped.map((entry) => (
              <li key={`${entry.index}-${entry.id ?? 'unnamed'}`}>
                The filter {entry.id === null ? `at position ${entry.index + 1}` : `“${entry.id}”`}{' '}
                was dropped: {entry.reason}. Everything else still filters normally.
              </li>
            ))}
          </ul>
        </output>
      ) : null}

      {ignored.length > 0 ? (
        <output className="border-warning bg-warning-surface text-fg flex items-start gap-2 rounded-md border p-2 text-xs">
          <ul className="flex flex-1 flex-col gap-1">
            {ignored.map((entry) => (
              <li key={entry.params.join('+')}>
                Ignored <code className="text-fg">{entry.params.join(' and ')}</code>
                {' = '}
                <code className="text-fg">{entry.value}</code>: {entry.reason}. The configured
                default is in force, and the address bar has been tidied to match it.
              </li>
            ))}
          </ul>

          <Button
            size="sm"
            variant="ghost"
            aria-label="Dismiss the ignored parameter notice"
            onClick={onDismissIgnored}
          >
            <X aria-hidden="true" className="size-3" />
          </Button>
        </output>
      ) : null}
    </section>
  )
}
