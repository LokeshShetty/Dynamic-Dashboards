/** The newest configuration format this build can render. */
export const CONFIG_SCHEMA_VERSION = 3

/** The oldest configuration format this build can still migrate forward. */
export const OLDEST_SUPPORTED_SCHEMA_VERSION = 1

/**
 * Hard limits, applied before validation. They exist to stop a hostile or accidental
 * configuration from costing more to reject than to render.
 */
export const CONFIG_LIMITS = {
  MAX_BYTES: 256 * 1024,
  MAX_DEPTH: 10,
  MAX_WIDGETS: 50,
  MAX_FILTERS: 20,
  MAX_TITLE_CHARS: 200,
  MAX_ID_CHARS: 64,
  MAX_FIELD_CHARS: 120,
  MAX_LABEL_CHARS: 120,
  MAX_TEXT_BODY_CHARS: 2000,
  MAX_TABLE_COLUMNS: 20,
  MAX_CHART_SERIES: 5,
  MAX_SELECT_OPTIONS: 50,
  MAX_GRID_COLUMNS: 12,
  MAX_GRID_ROWS: 100,
  MAX_ROW_SPAN: 4,
  MAX_PAGE_SIZE: 100,
  MAX_DECIMALS: 4,
} as const

/**
 * Keys that are rejected anywhere in a configuration, and field names a binding may not
 * point at. Reading row['__proto__'] hands a widget the prototype chain rather than data.
 */
export const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'] as const

export const WIDGET_KINDS = ['metric', 'table', 'chart', 'text'] as const
export const AGGREGATES = ['sum', 'avg', 'min', 'max', 'count', 'first', 'last'] as const
export const CHART_TYPES = ['line', 'bar', 'area'] as const
export const TIME_BUCKETS = ['day', 'week', 'month'] as const
export const FILTER_KINDS = ['select', 'multi-select', 'date-range', 'search'] as const
export const NUMBER_STYLES = ['plain', 'compact', 'currency', 'percent'] as const
export const SORT_DIRECTIONS = ['asc', 'desc'] as const
export const TEXT_TONES = ['default', 'note', 'warning'] as const
export const COLUMN_ALIGNMENTS = ['left', 'right'] as const

/** Presentation defaults a migration may supply. It may never supply a data binding. */
export const DEFAULT_SIZE_BY_KIND = {
  metric: { w: 3, h: 1 },
  chart: { w: 6, h: 2 },
  table: { w: 12, h: 2 },
  text: { w: 12, h: 1 },
} as const

export const DEFAULT_GRID_COLUMNS = 12
export const DEFAULT_PAGE_SIZE = 10

export type WidgetKind = (typeof WIDGET_KINDS)[number]
export type Aggregate = (typeof AGGREGATES)[number]
export type FilterKind = (typeof FILTER_KINDS)[number]
