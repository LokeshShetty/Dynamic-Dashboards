import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { SeriesPoint } from '@/data/_types'

import {
  CHART_AXIS_STYLE,
  CHART_LEGEND_STYLE,
  CHART_MARGIN,
  CHART_SERIES_COLORS,
  CHART_TOOLTIP_STYLE,
} from '../../_constants'
import type { ValueFormatter } from '../../_lib/format'
import type { ChartSeries } from '../../_types'

type Props = {
  chartType: 'line' | 'bar' | 'area'
  points: SeriesPoint[]
  series: ChartSeries[]
  stacked: boolean
  /** Full values, for the tooltip. */
  format: ValueFormatter
  /** Short values, for the axis, where a full one would be clipped. */
  formatTick: ValueFormatter
}

function colorAt(index: number) {
  return CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length]
}

export function ChartCanvas({ chartType, points, series, stacked, format, formatTick }: Props) {
  const rows = points.map((point) => ({ x: point.x, ...point.values }))

  /** One series needs no legend: the axis already names what each bar or line is. */
  const showsLegend = series.length > 1

  const shared = (
    <>
      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="x" tick={CHART_AXIS_STYLE} stroke="var(--border-strong)" minTickGap={16} />
      <YAxis
        tick={CHART_AXIS_STYLE}
        stroke="var(--border-strong)"
        width={64}
        tickCount={5}
        tickFormatter={(value) => formatTick(value)}
      />
      <Tooltip
        formatter={(value) => format(typeof value === 'number' ? value : null)}
        contentStyle={CHART_TOOLTIP_STYLE}
        cursor={{ fill: 'var(--surface-muted)', fillOpacity: 0.5 }}
      />
      {showsLegend ? <Legend wrapperStyle={CHART_LEGEND_STYLE} /> : null}
    </>
  )

  if (chartType === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%" minHeight={80}>
        <BarChart data={rows} margin={CHART_MARGIN}>
          {shared}
          {series.map((entry, index) => (
            <Bar
              key={entry.key}
              dataKey={entry.key}
              name={entry.label}
              stackId={stacked ? 'stack' : undefined}
              fill={colorAt(index)}
            >
              {/* With one series the bars are the categories, so each takes its own colour. */}
              {showsLegend
                ? null
                : rows.map((row, rowIndex) => (
                    <Cell key={String(row.x)} fill={colorAt(rowIndex)} />
                  ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={80}>
      <LineChart data={rows} margin={CHART_MARGIN}>
        {shared}
        {series.map((entry, index) => (
          <Line
            key={entry.key}
            /* Buckets are discrete: a smoothed curve would imply values between them. */
            type="linear"
            dataKey={entry.key}
            name={entry.label}
            dot={{ r: 2, strokeWidth: 0, fill: colorAt(index) }}
            activeDot={{ r: 4 }}
            strokeWidth={2}
            stroke={colorAt(index)}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
