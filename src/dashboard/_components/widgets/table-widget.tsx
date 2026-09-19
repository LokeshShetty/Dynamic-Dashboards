import type { DataResult } from '@/data/_types'

import { useWidgetData } from '../../_hooks/use-widget-data'
import type { TableWidget } from '../../_lib/config.schema'
import { ignoredFilterLabels, unappliedFiltersOf } from '../../_lib/filter-notices'
import { toColumnViews } from '../../_lib/table-columns'
import { toDataFilters, toTableQuery } from '../../_lib/to-data-query'
import { withPresentationCheck } from '../../_lib/widget-state'
import type { WidgetFilterContext } from '../../_types'
import { TableSkeleton } from '../skeletons/widget-skeletons'
import { WidgetFrame } from '../widget-frame'
import { DataTable } from './data-table'

type Props = {
  dashboardId: string
  dataset: string
  widget: TableWidget
  filters: WidgetFilterContext
}

export function TableWidgetTile({ dashboardId, dataset, widget, filters }: Props) {
  // A widget that opts out of a filter does not get it, which is the point of the setting.
  const applied = toDataFilters(filters.definitions, filters.values, widget.ignoredFilterIds)

  const { state, refresh } = useWidgetData({
    dashboardId,
    widgetId: widget.id,
    query: toTableQuery(widget, dataset, applied),
  })

  // Only a table with nothing left to show is unresolvable. One dead column is the column's
  // problem, and it is marked as such in the header.
  const checked = withPresentationCheck(state, (result) => checkTable(result, widget))

  return (
    <WidgetFrame
      title={widget.title}
      widgetId={widget.id}
      state={checked}
      skeleton={<TableSkeleton rows={Math.min(widget.pageSize, 6)} />}
      configText={JSON.stringify(widget, null, 2)}
      onRefresh={refresh}
      unappliedFilters={unappliedFiltersOf(checked, filters.labels)}
      ignoredFilters={ignoredFilterLabels(widget.ignoredFilterIds, filters.definitions)}
    >
      {(result) =>
        result.kind === 'rows' ? (
          <DataTable
            columns={toColumnViews(widget.columns, result.columns)}
            rows={result.rows}
            matchedRows={result.matchedRows}
            sort={result.sort}
            pageSize={widget.pageSize}
          />
        ) : null
      }
    </WidgetFrame>
  )
}

function checkTable(result: DataResult, widget: TableWidget): string | null {
  if (result.kind !== 'rows') return 'the data source answered with the wrong shape for a table'

  const views = toColumnViews(widget.columns, result.columns)
  const usable = views.filter((column) => column.kind === 'ok')

  if (usable.length > 0) return null

  const firstReason = views.find((column) => column.kind === 'unresolved')?.reason
  return firstReason ?? 'none of the configured columns exist in this dataset any more'
}
