import { CONFIG_LIMITS } from '../_constants'
import type { WidgetSlot } from '../_types'
import type { WidgetLayout } from './config.schema'

/**
 * Two widgets cannot own the same cell. The first one to claim it keeps it, and any later
 * widget that collides becomes an invalid tile naming what it collided with, because a
 * dashboard that silently reflows is a dashboard nobody can trust to look the same twice.
 */
export function markOverlappingWidgets(slots: ReadonlyArray<WidgetSlot>): WidgetSlot[] {
  const ownerByCell = new Map<string, string>()

  return slots.map((slot) => {
    if (slot.kind !== 'valid') return slot

    const cells = cellsOf(slot.widget.layout)
    const collision = cells
      .map((cell) => ownerByCell.get(cell))
      .find((owner): owner is string => owner !== undefined)

    if (collision !== undefined) {
      return { kind: 'overlapping-layout', index: slot.index, id: slot.id, overlapsId: collision }
    }

    for (const cell of cells) ownerByCell.set(cell, slot.id)

    return slot
  })
}

function cellsOf(layout: WidgetLayout): string[] {
  const cells: string[] = []
  const lastColumn = Math.min(layout.x + layout.w, CONFIG_LIMITS.MAX_GRID_COLUMNS)
  const lastRow = Math.min(layout.y + layout.h, CONFIG_LIMITS.MAX_GRID_ROWS)

  for (let row = layout.y; row < lastRow; row += 1) {
    for (let column = layout.x; column < lastColumn; column += 1) {
      cells.push(`${column},${row}`)
    }
  }

  return cells
}
