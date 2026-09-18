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

import type { ValueFormatter } from '../../_lib/format'

export type ChartSeries = { key: string; label: string }

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

/** Series colours come from the theme tokens, so they stay legible in both themes. */
const SERIES_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

const AXIS_STYLE = { fill: 'var(--fg-muted)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }

const TOOLTIP_STYLE = {
  background: 'var(--surface-raised)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--fg)',
  fontSize: 12,
}

const LEGEND_STYLE = { fontSize: 11, color: 'var(--fg-muted)' }

function colorAt(index: number) {
  return SERIES_COLORS[index % SERIES_COLORS.length]
}

export function ChartCanvas({ chartType, points, series, stacked, format, formatTick }: Props) {
  const rows = points.map((point) => ({ x: point.x, ...point.values }))
  const isCategorical = chartType === 'bar' && series.length === 1

  const shared = (
    <>
      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="x" tick={AXIS_STYLE} stroke="var(--border-strong)" minTickGap={16} />
      <YAxis
        tick={AXIS_STYLE}
        stroke="var(--border-strong)"
        width={64}
        tickCount={5}
        tickFormatter={(value) => formatTick(value)}
      />
      <Tooltip
        formatter={(value) => format(typeof value === 'number' ? value : null)}
        contentStyle={TOOLTIP_STYLE}
        cursor={{ fill: 'var(--surface-muted)', fillOpacity: 0.5 }}
      />
    </>
  )

  if (chartType === 'bar') {
    return (
      <div className="flex h-full min-h-0 flex-col gap-1">
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%" minHeight={140}>
            <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              {shared}
              {isCategorical ? null : <Legend wrapperStyle={LEGEND_STYLE} />}

              {series.map((entry, index) => (
                <Bar
                  key={entry.key}
                  dataKey={entry.key}
                  name={entry.label}
                  stackId={stacked ? 'stack' : undefined}
                  fill={colorAt(index)}
                >
                  {isCategorical
                    ? rows.map((row, rowIndex) => (
                        <Cell key={String(row.x)} fill={colorAt(rowIndex)} />
                      ))
                    : null}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* One bar per category reads as a set of categories, so the legend names them. */}
        {isCategorical ? (
          <ul className="text-fg-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {rows.map((row, index) => (
              <li key={String(row.x)} className="inline-flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-xs"
                  style={{ background: colorAt(index) }}
                />
                {String(row.x)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={140}>
      <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        {shared}
        {series.length > 1 ? <Legend wrapperStyle={LEGEND_STYLE} /> : null}

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
