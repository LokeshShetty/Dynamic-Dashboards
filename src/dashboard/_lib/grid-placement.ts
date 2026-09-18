import type { GridPlacement } from '../_components/widget-grid'
import { CONFIG_LIMITS } from '../_constants'
import type { WidgetSlot } from '../_types'
import type { Widget } from './config.schema'

/** What each kind needs to stay readable, so a tile cannot be dragged down to a sliver. */
const MIN_SIZE_BY_KIND = {
  metric: { w: 2, h: 1 },
  chart: { w: 3, h: 2 },
  table: { w: 4, h: 2 },
  text: { w: 2, h: 1 },
} as const

export function gridKeyFor(index: number) {
  return `slot-${index}`
}

export function indexFromGridKey(key: string): number | null {
  const index = Number(key.replace('slot-', ''))
  return Number.isInteger(index) ? index : null
}

/**
 * Where every tile sits, including the ones that failed validation: a widget with no usable
 * layout still takes a place on the grid, below the rest, rather than disappearing.
 */
export function toGridPlacements(slots: ReadonlyArray<WidgetSlot>): GridPlacement[] {
  const lowestFreeRow =
    slots.reduce((lowest, slot) => {
      if (slot.kind !== 'valid') return lowest
      return Math.max(lowest, slot.widget.layout.y + slot.widget.layout.h)
    }, 0) + 1

  let strayRow = lowestFreeRow

  return slots.map((slot) => {
    const key = gridKeyFor(slot.index)

    if (slot.kind !== 'valid') {
      const placement = {
        key,
        x: 0,
        y: strayRow,
        w: 4,
        h: 1,
        minW: 2,
        minH: 1,
        maxW: CONFIG_LIMITS.MAX_GRID_COLUMNS,
        maxH: CONFIG_LIMITS.MAX_ROW_SPAN,
      }
      strayRow += 1
      return placement
    }

    return { key, ...slot.widget.layout, ...limitsFor(slot.widget) }
  })
}

function limitsFor(widget: Widget) {
  const min = MIN_SIZE_BY_KIND[widget.kind]

  return {
    minW: min.w,
    minH: min.h,
    maxW: CONFIG_LIMITS.MAX_GRID_COLUMNS,
    maxH: CONFIG_LIMITS.MAX_ROW_SPAN,
  }
}
