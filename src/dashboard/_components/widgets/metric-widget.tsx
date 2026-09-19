import type { DataResult } from '@/data/_types'
import { humanizeFieldName } from '@/lib/text'

import { AGGREGATE_LABELS } from '../../_constants'
import { useWidgetData } from '../../_hooks/use-widget-data'
import type { MetricWidget } from '../../_lib/config.schema'
import { ignoredFilterLabels, unappliedFiltersOf } from '../../_lib/filter-notices'
import { formatByType, resolveFormatter } from '../../_lib/format'
import { toDataFilters, toMetricQuery } from '../../_lib/to-data-query'
import { withPresentationCheck } from '../../_lib/widget-state'
import type { WidgetFilterContext } from '../../_types'
import { MetricSkeleton } from '../skeletons/widget-skeletons'
import { WidgetFrame } from '../widget-frame'

type Props = {
  dashboardId: string
  dataset: string
  widget: MetricWidget
  filters: WidgetFilterContext
}

export function MetricWidgetTile({ dashboardId, dataset, widget, filters }: Props) {
  // A widget that opts out of a filter does not get it, which is the point of the setting.
  const applied = toDataFilters(filters.definitions, filters.values, widget.ignoredFilterIds)

  const { state, refresh } = useWidgetData({
    dashboardId,
    widgetId: widget.id,
    query: toMetricQuery(widget, dataset, applied),
  })

  const checked = withPresentationCheck(state, (result) => checkMetric(result, widget))

  return (
    <WidgetFrame
      title={widget.title}
      widgetId={widget.id}
      state={checked}
      skeleton={<MetricSkeleton />}
      configText={JSON.stringify(widget, null, 2)}
      onRefresh={refresh}
      unappliedFilters={unappliedFiltersOf(checked, filters.labels)}
      ignoredFilters={ignoredFilterLabels(widget.ignoredFilterIds, filters.definitions)}
    >
      {(result) => <MetricValue result={result} widget={widget} />}
    </WidgetFrame>
  )
}

function MetricValue({ result, widget }: { result: DataResult; widget: MetricWidget }) {
  if (result.kind !== 'value') return null

  const formatter = resolveFormatter(result.field, widget.format)
  const text = formatter.ok
    ? formatter.data(result.value)
    : formatByType(result.value, result.field)

  return (
    <div className="flex flex-col gap-1">
      <p className="text-fg text-3xl font-semibold tabular-nums">{text}</p>
      <p className="text-fg-muted text-xs tabular-nums">{provenanceOf(result, widget)}</p>
    </div>
  )
}

/**
 * What the number is, in one line. Count is the odd one out: it counts the values that are
 * there, not the rows that matched, and those differ whenever a column has gaps. Saying "count
 * of paid at over 5,000 rows" above the number 3,214 reads as though the two agree.
 */
function provenanceOf(result: DataResult, widget: MetricWidget): string {
  if (result.kind !== 'value') return ''

  const name = humanizeFieldName(result.field.name, result.field.unit)
  const rows = result.matchedRows.toLocaleString()

  if (widget.value.aggregate === 'count') {
    return `rows with a value in ${name}, out of ${rows} matching`
  }

  return `${AGGREGATE_LABELS[widget.value.aggregate]} of ${name} over ${rows} matching rows`
}

/**
 * A metric is a number. An aggregate other than count over a field that is not numeric has no
 * honest answer, and neither does a currency format over a field that carries no money, so
 * both say so instead of rendering something that looks like a figure.
 */
function checkMetric(result: DataResult, widget: MetricWidget): string | null {
  if (result.kind !== 'value') return 'the data source answered with the wrong shape for a metric'

  // The same rule the query engine applies, rather than a stricter one: totals and averages need
  // numbers, extremes need something ordered, and first and last work over anything. Refusing a
  // latest date the engine had already computed was the widget claiming it could not show an
  // answer it was holding, and the editor offered that aggregate for that field.
  const aggregate = widget.value.aggregate
  const type = result.field.type
  const name = humanizeFieldName(result.field.name, result.field.unit)

  if ((aggregate === 'sum' || aggregate === 'avg') && type !== 'number') {
    return `a ${AGGREGATE_LABELS[aggregate].toLowerCase()} needs a number field, and ${name} is ${type}`
  }

  if ((aggregate === 'min' || aggregate === 'max') && type === 'boolean') {
    return `${AGGREGATE_LABELS[aggregate].toLowerCase()} needs a field that can be ordered, and ${name} is a yes or no`
  }

  const formatter = resolveFormatter(result.field, widget.format)
  return formatter.ok ? null : formatter.error
}
