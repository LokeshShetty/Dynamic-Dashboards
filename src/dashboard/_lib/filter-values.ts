import type { DashboardFilter } from './config.schema'
import type { FilterValues } from './to-data-query'

/**
 * The values a dashboard starts with. In the next phase these come from the URL, with the
 * configuration only supplying the defaults, so a link carries the filters with it.
 */
export function defaultFilterValues(filters: ReadonlyArray<DashboardFilter>): FilterValues {
  const values: FilterValues = {}

  for (const filter of filters) {
    values[filter.id] = filter.defaultValue ?? null
  }

  return values
}
