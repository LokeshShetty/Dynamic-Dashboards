import { AGGREGATES, type Aggregate, type FieldType } from '@/constants/data'
import { isRecord } from '@/lib/guards'
import type { DatasetField } from '@/types/data'

import { DEFAULT_PAGE_SIZE, NUMBER_STYLES } from '../_constants'
import type {
  ChartWidget,
  MetricWidget,
  NumberFormat,
  TableWidget,
  TextWidget,
} from './config.schema'

/**
 * Form defaults are read defensively, because the editor has to be able to open a widget that
 * is already broken. A missing field comes back as an empty string rather than being dropped,
 * so the form shows what the configuration actually says and lets it be corrected.
 */
export function readMetricDefaults(entry: unknown): MetricWidget {
  const base = readBase(entry, 'metric')
  const value = isRecord(entry) && isRecord(entry.value) ? entry.value : {}

  return {
    ...base,
    kind: 'metric',
    value: {
      field: readString(value.field),
      aggregate: readAggregate(value.aggregate),
    },
    ...(isRecord(entry) && isRecord(entry.format) ? { format: readFormat(entry.format) } : {}),
  }
}

export function readTableDefaults(entry: unknown): TableWidget {
  const base = readBase(entry, 'table')
  const columns = isRecord(entry) && Array.isArray(entry.columns) ? entry.columns : []

  return {
    ...base,
    kind: 'table',
    columns: columns.length > 0 ? columns.map(readColumn) : [{ field: '' }],
    pageSize:
      isRecord(entry) && typeof entry.pageSize === 'number' ? entry.pageSize : DEFAULT_PAGE_SIZE,
    ...(isRecord(entry) && isRecord(entry.sort)
      ? {
          sort: {
            field: readString(entry.sort.field),
            direction: entry.sort.direction === 'asc' ? 'asc' : 'desc',
          },
        }
      : {}),
  }
}

export function readChartDefaults(entry: unknown): ChartWidget {
  const base = readBase(entry, 'chart')
  const x = isRecord(entry) && isRecord(entry.x) ? entry.x : {}
  const series = isRecord(entry) && Array.isArray(entry.series) ? entry.series : []

  return {
    ...base,
    kind: 'chart',
    chartType: readChartType(isRecord(entry) ? entry.chartType : undefined),
    x: {
      field: readString(x.field),
      ...(x.bucket === 'day' || x.bucket === 'week' || x.bucket === 'month'
        ? { bucket: x.bucket }
        : {}),
    },
    series:
      series.length > 0 ? series.map(readSeries) : [{ field: '', aggregate: 'count' as Aggregate }],
    ...(isRecord(entry) && isRecord(entry.groupBy)
      ? { groupBy: { field: readString(entry.groupBy.field) } }
      : {}),
    ...(isRecord(entry) && typeof entry.stacked === 'boolean' ? { stacked: entry.stacked } : {}),
  }
}

export function readTextDefaults(entry: unknown): TextWidget {
  const base = readBase(entry, 'text')

  return {
    ...base,
    kind: 'text',
    body: isRecord(entry) && typeof entry.body === 'string' ? entry.body : '',
    ...(isRecord(entry) && (entry.tone === 'note' || entry.tone === 'warning')
      ? { tone: entry.tone }
      : {}),
  }
}

/** Which aggregates mean anything over this field, mirroring what the executor will accept. */
export function aggregatesFor(type: FieldType | null): Aggregate[] {
  if (type === null) return [...AGGREGATES]
  if (type === 'number') return [...AGGREGATES]
  if (type === 'boolean') return ['count', 'first', 'last']
  return ['count', 'min', 'max', 'first', 'last']
}

export function fieldTypeOf(fields: ReadonlyArray<DatasetField>, name: string): FieldType | null {
  return fields.find((field) => field.name === name)?.type ?? null
}

function readColumn(column: unknown): TableWidget['columns'][number] {
  const source = isRecord(column) ? column : {}

  return {
    field: readString(source.field),
    ...(typeof source.label === 'string' ? { label: source.label } : {}),
    ...(source.align === 'left' || source.align === 'right' ? { align: source.align } : {}),
    ...(isRecord(source.format) ? { format: readFormat(source.format) } : {}),
  }
}

function readSeries(series: unknown): ChartWidget['series'][number] {
  const source = isRecord(series) ? series : {}

  return {
    field: readString(source.field),
    aggregate: readAggregate(source.aggregate),
    ...(typeof source.label === 'string' ? { label: source.label } : {}),
    ...(isRecord(source.format) ? { format: readFormat(source.format) } : {}),
  }
}

function readBase(entry: unknown, kind: string) {
  const layout = isRecord(entry) && isRecord(entry.layout) ? entry.layout : {}

  return {
    id: readString(isRecord(entry) ? entry.id : '') || `${kind}-1`,
    title: readString(isRecord(entry) ? entry.title : ''),
    layout: {
      x: readNumber(layout.x, 0),
      y: readNumber(layout.y, 0),
      w: readNumber(layout.w, 3),
      h: readNumber(layout.h, 1),
    },
    ...(isRecord(entry) && typeof entry.dataset === 'string' ? { dataset: entry.dataset } : {}),
    ...(isRecord(entry) && Array.isArray(entry.ignoredFilterIds)
      ? { ignoredFilterIds: entry.ignoredFilterIds.filter((id) => typeof id === 'string') }
      : {}),
  }
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readAggregate(value: unknown): Aggregate {
  return AGGREGATES.find((candidate) => candidate === value) ?? 'count'
}

function readChartType(value: unknown): ChartWidget['chartType'] {
  if (value === 'line' || value === 'bar' || value === 'area') return value
  return 'bar'
}

function readFormat(format: Record<string, unknown>): NumberFormat {
  const style = NUMBER_STYLES.find((candidate) => candidate === format.style) ?? 'plain'

  return {
    style,
    ...(typeof format.decimals === 'number' ? { decimals: format.decimals } : {}),
    ...(typeof format.currency === 'string' ? { currency: format.currency } : {}),
  }
}
