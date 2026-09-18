import {
  Bar,
  BarChart,
  CartesianGrid,
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
  format: ValueFormatter
}

/** Series colours come from the theme tokens, so they stay legible in both themes. */
const SERIES_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
]

export function ChartCanvas({ chartType, points, series, stacked, format }: Props) {
  const rows = points.map((point) => ({ x: point.x, ...point.values }))
  const axisStyle = { fill: 'var(--fg-muted)', fontSize: 11 }

  const shared = (
    <>
      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="x" tick={axisStyle} stroke="var(--border-strong)" minTickGap={16} />
      <YAxis
        tick={axisStyle}
        stroke="var(--border-strong)"
        tickFormatter={(value) => format(value)}
      />
      <Tooltip
        formatter={(value) => format(typeof value === 'number' ? value : null)}
        contentStyle={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          color: 'var(--fg)',
          fontSize: 12,
        }}
      />
      {series.length > 1 ? (
        <Legend wrapperStyle={{ fontSize: 11, color: 'var(--fg-muted)' }} />
      ) : null}
    </>
  )

  if (chartType === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%" minHeight={140}>
        <BarChart data={rows}>
          {shared}
          {series.map((entry, index) => (
            <Bar
              key={entry.key}
              dataKey={entry.key}
              name={entry.label}
              stackId={stacked ? 'stack' : undefined}
              fill={SERIES_COLORS[index % SERIES_COLORS.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={140}>
      <LineChart data={rows}>
        {shared}
        {series.map((entry, index) => (
          <Line
            key={entry.key}
            type="monotone"
            dataKey={entry.key}
            name={entry.label}
            dot={false}
            strokeWidth={2}
            stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
