import type { DashboardFilter } from '../../_lib/config.schema'
import type { FilterValue } from '../../_lib/to-data-query'
import { DateRangeFilterControl } from './date-range-filter-control'
import { MultiSelectFilterControl } from './multi-select-filter-control'
import { SearchFilterControl } from './search-filter-control'
import { SelectFilterControl } from './select-filter-control'

type Props = {
  filter: DashboardFilter
  dataset: string
  value: FilterValue
  onChange: (value: FilterValue) => void
}

export function FilterControl({ filter, dataset, value, onChange }: Props) {
  switch (filter.kind) {
    case 'select':
      return (
        <SelectFilterControl
          filter={filter}
          dataset={dataset}
          value={typeof value === 'string' ? value : null}
          onChange={onChange}
        />
      )

    case 'multi-select':
      return (
        <MultiSelectFilterControl
          filter={filter}
          dataset={dataset}
          value={Array.isArray(value) ? value : null}
          onChange={onChange}
        />
      )

    case 'date-range':
      return (
        <DateRangeFilterControl
          filter={filter}
          value={
            value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null
          }
          onChange={onChange}
        />
      )

    case 'search':
      return (
        <SearchFilterControl
          filter={filter}
          value={typeof value === 'string' ? value : null}
          onChange={onChange}
        />
      )
  }
}
