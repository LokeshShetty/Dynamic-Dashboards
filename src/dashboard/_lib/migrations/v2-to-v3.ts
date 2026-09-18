import { isRecord } from '@/lib/guards'

import { CONFIG_LIMITS, DEFAULT_SIZE_BY_KIND, WIDGET_KINDS } from '../../_constants'

/**
 * v2 to v3: widgets were sized in spans and rendered in array order. v3 places them on the
 * grid explicitly, so a dashboard looks the same whatever order it is stored in and two
 * widgets can be seen to collide rather than quietly reflowing each other.
 *
 * Positions are computed by flowing the v2 widgets exactly the way v2 rendered them, so an
 * upgraded dashboard opens looking like it did before.
 */
export function migrateV2ToV3(input: unknown): unknown {
  if (!isRecord(input) || input.schemaVersion !== 2) return input

  return {
    ...input,
    schemaVersion: 3,
    widgets: Array.isArray(input.widgets) ? placeWidgets(input.widgets) : input.widgets,
  }
}

function placeWidgets(widgets: ReadonlyArray<unknown>): unknown[] {
  let x = 0
  let y = 0
  let rowHeight = 0

  return widgets.map((widget) => {
    if (!isRecord(widget)) return widget

    const size = readSpan(widget)
    if (!size) return widget

    if (x + size.w > CONFIG_LIMITS.MAX_GRID_COLUMNS) {
      x = 0
      y += rowHeight
      rowHeight = 0
    }

    const placed = { ...widget, layout: { x, y, w: size.w, h: size.h } }

    x += size.w
    rowHeight = Math.max(rowHeight, size.h)

    return placed
  })
}

/** Falls back to the default size for the kind, which is presentation, never a binding. */
function readSpan(widget: Record<string, unknown>) {
  const kind = WIDGET_KINDS.find((candidate) => candidate === widget.kind)
  const fallback = DEFAULT_SIZE_BY_KIND[kind ?? 'text']
  const layout = widget.layout

  if (!isRecord(layout)) return fallback

  const w = typeof layout.colSpan === 'number' ? layout.colSpan : fallback.w
  const h = typeof layout.rowSpan === 'number' ? layout.rowSpan : fallback.h

  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) return fallback
  if (w > CONFIG_LIMITS.MAX_GRID_COLUMNS) return fallback

  return { w, h }
}
