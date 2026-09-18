import { Filter, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { DashboardFilter } from '../../_lib/config.schema'
import type { IgnoredParam } from '../../_lib/filter-params'
import type { FilterValue, FilterValues } from '../../_lib/to-data-query'
import { FilterControl } from './filter-control'

type Props = {
  filters: ReadonlyArray<DashboardFilter>
  dataset: string
  values: FilterValues
  activeCount: number
  ignored: IgnoredParam[]
  onChange: (filter: DashboardFilter, value: FilterValue) => void
  onReset: () => void
}

export function FilterBar({
  filters,
  dataset,
  values,
  activeCount,
  ignored,
  onChange,
  onReset,
}: Props) {
  if (filters.length === 0) return null

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

      {ignored.length > 0 ? (
        <output className="border-warning bg-warning-surface text-fg block rounded-md border p-2 text-xs">
          <ul className="flex flex-col gap-1">
            {ignored.map((entry) => (
              <li key={entry.param}>
                Ignored <code className="text-fg">{entry.param}</code>=
                <code className="text-fg">{entry.value}</code>: {entry.reason}. Using the configured
                default instead.
              </li>
            ))}
          </ul>
        </output>
      ) : null}
    </section>
  )
}
