import { lazy, Suspense } from 'react'

import type { DataFilter, DataResult } from '@/data/_types'

import { useWidgetData } from '../../_hooks/use-widget-data'
import type { ChartWidget } from '../../_lib/config.schema'
import { resolveFormatter } from '../../_lib/format'
import { toChartQuery } from '../../_lib/to-data-query'
import { withPresentationCheck } from '../../_lib/widget-state'
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
  filters: DataFilter[]
}

export function ChartWidgetTile({ dashboardId, dataset, widget, filters }: Props) {
  const { state, refresh } = useWidgetData({
    dashboardId,
    widgetId: widget.id,
    query: toChartQuery(widget, dataset, filters),
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
    >
      {(result) => {
        if (result.kind !== 'series') return null

        const formatter = resolveFormatter(
          result.series[0]?.field ?? result.x,
          widget.series[0]?.format,
        )

        return (
          <div className="min-h-36 flex-1">
            <Suspense fallback={<ChartSkeleton />}>
              <ChartCanvas
                chartType={widget.chartType}
                points={result.points}
                stacked={widget.stacked ?? false}
                format={formatter.ok ? formatter.data : (value) => String(value ?? '')}
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
 * A chart needs an axis it can lay out and a value it can measure. A numeric x is refused
 * because plotting one as a category invents an ordering, and a non numeric y is refused
 * because there is nothing to plot.
 */
function checkChart(result: DataResult, widget: ChartWidget): string | null {
  if (result.kind !== 'series') return 'the data source answered with the wrong shape for a chart'

  if (result.x.type === 'number') {
    return `"${result.x.name}" is a number, and a chart axis needs a category or a date`
  }

  for (const [index, series] of result.series.entries()) {
    const aggregate = widget.groupBy ? widget.series[0]?.aggregate : widget.series[index]?.aggregate

    if (aggregate !== 'count' && series.field.type !== 'number') {
      return `"${series.field.name}" is ${series.field.type}, and a chart value needs a number`
    }
  }

  return null
}
