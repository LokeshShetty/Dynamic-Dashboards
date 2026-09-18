import { isRecord, isString } from '@/lib/guards'

import {
  DEFAULT_GRID_COLUMNS,
  DEFAULT_LAYOUT_BY_KIND,
  DEFAULT_PAGE_SIZE,
  WIDGET_KINDS,
} from '../../_constants'

/**
 * v1 to v2: `name` became `title`, `source` became `dataset`, widget `type` became `kind`,
 * and the flat metric and chart bindings became nested objects.
 *
 * The migration runs before validation, so it must survive malformed input. It supplies
 * presentation defaults (layout, page size) but never a data binding: a missing aggregate
 * stays missing so validation can report it, rather than being guessed into a wrong number.
 */
export function migrateV1ToV2(input: unknown): unknown {
  if (!isRecord(input) || input.schemaVersion !== 1) return input

  const migrated: Record<string, unknown> = {
    schemaVersion: 2,
    id: input.id,
    title: input.name,
    version: typeof input.version === 'number' ? input.version : 1,
    dataset: input.source,
    layout: { columns: DEFAULT_GRID_COLUMNS },
    filters: [],
    widgets: Array.isArray(input.widgets) ? input.widgets.map(migrateWidget) : input.widgets,
  }

  if (isString(input.updatedAt)) migrated.updatedAt = input.updatedAt

  return migrated
}

function defaultLayoutFor(type: unknown) {
  const kind = WIDGET_KINDS.find((candidate) => candidate === type)
  return { ...DEFAULT_LAYOUT_BY_KIND[kind ?? 'text'] }
}

function migrateWidget(widget: unknown): unknown {
  if (!isRecord(widget)) return widget

  const base = {
    id: widget.id,
    title: widget.title,
    layout: defaultLayoutFor(widget.type),
  }

  switch (widget.type) {
    case 'metric':
      return {
        ...base,
        kind: 'metric',
        value: { field: widget.field, aggregate: widget.agg },
        ...(widget.format === undefined ? {} : { format: { style: widget.format } }),
      }

    case 'chart':
      return {
        ...base,
        kind: 'chart',
        chartType: widget.chart,
        x: { field: widget.x },
        series: Array.isArray(widget.series)
          ? widget.series.map((field) => ({ field, aggregate: widget.agg }))
          : widget.series,
        ...(widget.stacked === undefined ? {} : { stacked: widget.stacked }),
      }

    case 'table':
      return {
        ...base,
        kind: 'table',
        columns: Array.isArray(widget.columns)
          ? widget.columns.map((field) => ({ field }))
          : widget.columns,
        pageSize: typeof widget.rows === 'number' ? widget.rows : DEFAULT_PAGE_SIZE,
      }

    case 'text':
      return { ...base, kind: 'text', body: widget.text }

    default:
      // An unknown v1 type is carried through as the kind it claimed to be, so validation
      // reports "unknown widget kind" on that one tile instead of the migration guessing.
      return { ...base, kind: widget.type }
  }
}
