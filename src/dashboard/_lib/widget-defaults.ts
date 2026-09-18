import { DEFAULT_PAGE_SIZE, DEFAULT_SIZE_BY_KIND, type WidgetKind } from '../_constants'
import type { Rect } from './layout'

/**
 * What a widget looks like the moment it is added. Bindings are left empty rather than guessed:
 * the editor opens on the new tile straight away, and until a field is chosen the tile says it
 * is not configured yet. A guessed field would be a binding nobody asked for.
 */
export function newWidgetEntry(kind: WidgetKind, id: string, rect: Rect): Record<string, unknown> {
  const base = { id, title: defaultTitle(kind), layout: rect }

  switch (kind) {
    case 'metric':
      return { ...base, kind, value: { field: '', aggregate: 'count' } }

    case 'table':
      return { ...base, kind, columns: [{ field: '' }], pageSize: DEFAULT_PAGE_SIZE }

    case 'chart':
      return {
        ...base,
        kind,
        chartType: 'bar',
        x: { field: '' },
        series: [{ field: '', aggregate: 'count' }],
      }

    case 'text':
      return { ...base, kind, body: 'New note' }
  }
}

export function defaultSizeFor(kind: WidgetKind) {
  return { ...DEFAULT_SIZE_BY_KIND[kind] }
}

function defaultTitle(kind: WidgetKind) {
  switch (kind) {
    case 'metric':
      return 'New metric'
    case 'table':
      return 'New table'
    case 'chart':
      return 'New chart'
    case 'text':
      return 'New note'
  }
}
