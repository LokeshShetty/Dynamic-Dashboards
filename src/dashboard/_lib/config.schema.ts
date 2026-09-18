import { z } from 'zod'

import {
  AGGREGATES,
  CHART_TYPES,
  COLUMN_ALIGNMENTS,
  CONFIG_LIMITS,
  CONFIG_SCHEMA_VERSION,
  FORBIDDEN_KEYS,
  NUMBER_STYLES,
  SORT_DIRECTIONS,
  TEXT_TONES,
  TIME_BUCKETS,
} from '../_constants'

/**
 * The single source of truth for the configuration format. The loader, the editor form and
 * the hostile-configuration corpus all validate against these schemas, so a rule written
 * here cannot be contradicted somewhere else.
 */

const idSchema = z
  .string()
  .min(1)
  .max(CONFIG_LIMITS.MAX_ID_CHARS)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'must be letters, digits, dash or underscore')

const titleSchema = z.string().min(1).max(CONFIG_LIMITS.MAX_TITLE_CHARS)
const labelSchema = z.string().min(1).max(CONFIG_LIMITS.MAX_LABEL_CHARS)

/**
 * A binding points at a field in the dataset. The name is checked here as well as in the
 * shape guard: row['__proto__'] would hand a widget the prototype chain instead of data.
 */
const fieldNameSchema = z
  .string()
  .min(1)
  .max(CONFIG_LIMITS.MAX_FIELD_CHARS)
  .refine(
    (value) => !FORBIDDEN_KEYS.some((key) => key === value),
    'reserved field name, a binding may not point at it',
  )

const numberFormatSchema = z.strictObject({
  style: z.enum(NUMBER_STYLES),
  decimals: z.number().int().min(0).max(CONFIG_LIMITS.MAX_DECIMALS).optional(),
  currency: z.string().length(3).optional(),
})

/**
 * A place on the 12 column grid. A widget that runs past the right edge is rejected here, so
 * it becomes one invalid tile rather than a layout that silently reflows the dashboard.
 */
const layoutSchema = z
  .strictObject({
    x: z
      .number()
      .int()
      .min(0)
      .max(CONFIG_LIMITS.MAX_GRID_COLUMNS - 1),
    y: z
      .number()
      .int()
      .min(0)
      .max(CONFIG_LIMITS.MAX_GRID_ROWS - 1),
    w: z.number().int().min(1).max(CONFIG_LIMITS.MAX_GRID_COLUMNS),
    h: z.number().int().min(1).max(CONFIG_LIMITS.MAX_ROW_SPAN),
  })
  .refine((layout) => layout.x + layout.w <= CONFIG_LIMITS.MAX_GRID_COLUMNS, {
    message: `a widget at x plus its width may not pass column ${CONFIG_LIMITS.MAX_GRID_COLUMNS}`,
    path: ['w'],
  })

const widgetBaseShape = {
  id: idSchema,
  title: titleSchema,
  layout: layoutSchema,
  /** Optional: a widget may read from another dataset than the dashboard's own. */
  dataset: idSchema.optional(),
  ignoredFilterIds: z.array(idSchema).max(CONFIG_LIMITS.MAX_FILTERS).optional(),
}

export const metricWidgetSchema = z.strictObject({
  ...widgetBaseShape,
  kind: z.literal('metric'),
  value: z.strictObject({ field: fieldNameSchema, aggregate: z.enum(AGGREGATES) }),
  format: numberFormatSchema.optional(),
})

export const tableWidgetSchema = z.strictObject({
  ...widgetBaseShape,
  kind: z.literal('table'),
  columns: z
    .array(
      z.strictObject({
        field: fieldNameSchema,
        label: labelSchema.optional(),
        align: z.enum(COLUMN_ALIGNMENTS).optional(),
        format: numberFormatSchema.optional(),
      }),
    )
    .min(1)
    .max(CONFIG_LIMITS.MAX_TABLE_COLUMNS),
  pageSize: z.number().int().min(1).max(CONFIG_LIMITS.MAX_PAGE_SIZE),
  sort: z.strictObject({ field: fieldNameSchema, direction: z.enum(SORT_DIRECTIONS) }).optional(),
})

export const chartWidgetSchema = z
  .strictObject({
    ...widgetBaseShape,
    kind: z.literal('chart'),
    chartType: z.enum(CHART_TYPES),
    x: z.strictObject({ field: fieldNameSchema, bucket: z.enum(TIME_BUCKETS).optional() }),
    series: z
      .array(
        z.strictObject({
          field: fieldNameSchema,
          aggregate: z.enum(AGGREGATES),
          label: labelSchema.optional(),
          format: numberFormatSchema.optional(),
        }),
      )
      .min(1)
      .max(CONFIG_LIMITS.MAX_CHART_SERIES),
    /** One line per distinct value of this field, instead of one line per series binding. */
    groupBy: z.strictObject({ field: fieldNameSchema }).optional(),
    stacked: z.boolean().optional(),
  })
  .refine((chart) => chart.groupBy === undefined || chart.series.length === 1, {
    message: 'a chart that groups by a field must bind exactly one series',
    path: ['series'],
  })

export const textWidgetSchema = z.strictObject({
  ...widgetBaseShape,
  kind: z.literal('text'),
  body: z.string().min(1).max(CONFIG_LIMITS.MAX_TEXT_BODY_CHARS),
  tone: z.enum(TEXT_TONES).optional(),
})

export const widgetSchema = z.discriminatedUnion('kind', [
  metricWidgetSchema,
  tableWidgetSchema,
  chartWidgetSchema,
  textWidgetSchema,
])

const filterBaseShape = {
  id: idSchema,
  label: labelSchema,
  field: fieldNameSchema,
}

const selectOptionSchema = z.strictObject({
  value: z.string().min(1).max(CONFIG_LIMITS.MAX_LABEL_CHARS),
  label: labelSchema,
})

const selectFilterSchema = z
  .strictObject({
    ...filterBaseShape,
    kind: z.literal('select'),
    options: z.array(selectOptionSchema).min(1).max(CONFIG_LIMITS.MAX_SELECT_OPTIONS),
    defaultValue: z.string().max(CONFIG_LIMITS.MAX_LABEL_CHARS).optional(),
  })
  .refine(
    (filter) =>
      filter.defaultValue === undefined ||
      filter.options.some((option) => option.value === filter.defaultValue),
    { message: 'defaultValue is not one of the options', path: ['defaultValue'] },
  )

const multiSelectFilterSchema = z
  .strictObject({
    ...filterBaseShape,
    kind: z.literal('multi-select'),
    options: z.array(selectOptionSchema).min(1).max(CONFIG_LIMITS.MAX_SELECT_OPTIONS),
    defaultValue: z
      .array(z.string().max(CONFIG_LIMITS.MAX_LABEL_CHARS))
      .max(CONFIG_LIMITS.MAX_SELECT_OPTIONS)
      .optional(),
  })
  .refine(
    (filter) =>
      filter.defaultValue === undefined ||
      filter.defaultValue.every((value) => filter.options.some((option) => option.value === value)),
    {
      message: 'defaultValue contains a value that is not one of the options',
      path: ['defaultValue'],
    },
  )

const dateRangeFilterSchema = z
  .strictObject({
    ...filterBaseShape,
    kind: z.literal('date-range'),
    defaultValue: z.strictObject({ from: z.iso.date(), to: z.iso.date() }).optional(),
  })
  .refine(
    (filter) =>
      filter.defaultValue === undefined || filter.defaultValue.from <= filter.defaultValue.to,
    {
      message: 'defaultValue.from is after defaultValue.to',
      path: ['defaultValue'],
    },
  )

const searchFilterSchema = z.strictObject({
  ...filterBaseShape,
  kind: z.literal('search'),
  placeholder: labelSchema.optional(),
  defaultValue: z.string().max(CONFIG_LIMITS.MAX_LABEL_CHARS).optional(),
})

export const filterSchema = z.discriminatedUnion('kind', [
  selectFilterSchema,
  multiSelectFilterSchema,
  dateRangeFilterSchema,
  searchFilterSchema,
])

const dashboardShellShape = {
  schemaVersion: z.literal(CONFIG_SCHEMA_VERSION),
  id: idSchema,
  title: titleSchema,
  /** Save counter. Persistence compares it on write, so it is bookkeeping, not data. */
  version: z.number().int().min(0),
  updatedAt: z.iso.datetime().optional(),
  dataset: idSchema,
  layout: z.strictObject({
    columns: z.number().int().min(1).max(CONFIG_LIMITS.MAX_GRID_COLUMNS),
  }),
}

function hasUniqueFilterIds(filters: ReadonlyArray<{ id: string }>) {
  return new Set(filters.map((filter) => filter.id)).size === filters.length
}

/**
 * The dashboard without its widgets or its filters. Both are validated one entry at a time, so
 * that a single malformed widget cannot invalidate the widgets around it and a single malformed
 * filter cannot take the whole dashboard down with it.
 */
export const dashboardShellSchema = z.strictObject({
  ...dashboardShellShape,
  filters: z.array(z.unknown()).max(CONFIG_LIMITS.MAX_FILTERS),
  widgets: z.array(z.unknown()).max(CONFIG_LIMITS.MAX_WIDGETS),
})

/** The whole configuration, used when writing a configuration rather than reading one. */
export const dashboardConfigSchema = z
  .strictObject({
    ...dashboardShellShape,
    filters: z.array(filterSchema).max(CONFIG_LIMITS.MAX_FILTERS),
    widgets: z.array(widgetSchema).max(CONFIG_LIMITS.MAX_WIDGETS),
  })
  .refine((config) => hasUniqueFilterIds(config.filters), {
    message: 'duplicate filter id',
    path: ['filters'],
  })

export type Widget = z.infer<typeof widgetSchema>
export type MetricWidget = z.infer<typeof metricWidgetSchema>
export type TableWidget = z.infer<typeof tableWidgetSchema>
export type ChartWidget = z.infer<typeof chartWidgetSchema>
export type TextWidget = z.infer<typeof textWidgetSchema>
export type DashboardFilter = z.infer<typeof filterSchema>
export type DashboardShell = z.infer<typeof dashboardShellSchema>
export type DashboardConfig = z.infer<typeof dashboardConfigSchema>
export type WidgetLayout = z.infer<typeof layoutSchema>
export type NumberFormat = z.infer<typeof numberFormatSchema>
