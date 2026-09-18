import { lazy, Suspense } from 'react'

import type { DataResult } from '@/data/_types'

import { useWidgetData } from '../../_hooks/use-widget-data'
import type { ChartWidget } from '../../_lib/config.schema'
import { unappliedFiltersOf } from '../../_lib/filter-notices'
import { resolveFormatter } from '../../_lib/format'
import { toChartQuery } from '../../_lib/to-data-query'
import { withPresentationCheck } from '../../_lib/widget-state'
import type { WidgetFilterContext } from '../../_types'
import { ChartSkeleton } from '../skeletons/widget-skeletons'
import { WidgetFrame } from '../widget-frame'

/** Recharts is the heaviest thing here, so it arrives only when a chart is actually rendered. */
const ChartCanvas = lazy(() =>
  import('./chart-canvas').then((module) => ({ default: module.ChartCanvas })),
)

type Props = {
  dashboardId: string
  dataset: string
  widget: ChartWidget
  filters: WidgetFilterContext
}

export function ChartWidgetTile({ dashboardId, dataset, widget, filters }: Props) {
  const { state, refresh } = useWidgetData({
    dashboardId,
    widgetId: widget.id,
    query: toChartQuery(widget, dataset, filters.applied),
  })

  const checked = withPresentationCheck(state, (result) => checkChart(result, widget))

  return (
    <WidgetFrame
      title={widget.title}
      widgetId={widget.id}
      state={checked}
      skeleton={<ChartSkeleton />}
      configText={JSON.stringify(widget, null, 2)}
      onRefresh={refresh}
      unappliedFilters={unappliedFiltersOf(checked, filters.labels)}
    >
      {(result) => {
        if (result.kind !== 'series') return null

        const measured = result.series[0]?.field ?? result.x
        const formatter = resolveFormatter(measured, widget.series[0]?.format)
        const tickFormatter = resolveFormatter(measured, widget.series[0]?.format, 'compact')

        return (
          <div className="min-h-0 flex-1">
            <Suspense fallback={<ChartSkeleton />}>
              <ChartCanvas
                chartType={widget.chartType}
                points={result.points}
                stacked={widget.stacked ?? false}
                format={formatter.ok ? formatter.data : (value) => String(value ?? '')}
                formatTick={tickFormatter.ok ? tickFormatter.data : (value) => String(value ?? '')}
                series={result.series.map((series, index) => ({
                  key: series.key,
                  label:
                    series.groupValue ??
                    widget.series[index]?.label ??
                    `${widget.series[index]?.aggregate ?? ''} ${series.field.name}`.trim(),
                }))}
              />
            </Suspense>
          </div>
        )
      }}
    </WidgetFrame>
  )
}

/**
 * A chart needs an axis it can lay out and a value it can measure.
 *
 * Grouping and measuring are checked separately and never confused: the field a chart groups
 * by is meant to be a category, usually text, while the field it measures has to be a number.
 * Every series in a grouped chart measures the same field, so it is checked once.
 */
function checkChart(result: DataResult, widget: ChartWidget): string | null {
  if (result.kind !== 'series') return 'the data source answered with the wrong shape for a chart'

  if (result.x.type === 'number') {
    return `"${result.x.name}" is a number, and a chart axis needs a category or a date`
  }

  if (result.groupBy !== null && result.groupBy.type === 'number') {
    return `"${result.groupBy.name}" is a number, and grouping needs a category`
  }

  const measures = result.groupBy === null ? result.series : result.series.slice(0, 1)

  for (const [index, series] of measures.entries()) {
    const aggregate =
      result.groupBy === null ? widget.series[index]?.aggregate : widget.series[0]?.aggregate

    if (aggregate !== 'count' && series.field.type !== 'number') {
      return `"${series.field.name}" is ${series.field.type}, and a chart value needs a number`
    }
  }

  return null
}
