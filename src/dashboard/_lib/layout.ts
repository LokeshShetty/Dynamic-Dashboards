import { isRecord } from '@/lib/guards'

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

export type Rect = { x: number; y: number; w: number; h: number }

export type Placement = { id: string; rect: Rect }

export type PlacementRefusal =
  { kind: 'out-of-bounds'; message: string } | { kind: 'overlap'; withId: string }

/**
 * The editor checks a placement against the same rules the loader validates against, so it
 * cannot produce a layout that would come back as an invalid tile. Anything the loader would
 * reject is refused here, with a reason short enough to put in a notice.
 */
export function checkPlacement(
  placements: ReadonlyArray<Placement>,
  id: string,
  rect: Rect,
  columns: number,
): PlacementRefusal | null {
  if (rect.w < 1 || rect.h < 1) {
    return { kind: 'out-of-bounds', message: 'a widget cannot be smaller than one cell' }
  }

  if (rect.h > CONFIG_LIMITS.MAX_ROW_SPAN) {
    return {
      kind: 'out-of-bounds',
      message: `a widget cannot be taller than ${CONFIG_LIMITS.MAX_ROW_SPAN} rows`,
    }
  }

  if (rect.x < 0 || rect.y < 0) {
    return { kind: 'out-of-bounds', message: 'that would leave the top left of the grid' }
  }

  if (rect.x + rect.w > columns) {
    return { kind: 'out-of-bounds', message: `that would pass column ${columns}` }
  }

  if (rect.y + rect.h > CONFIG_LIMITS.MAX_GRID_ROWS) {
    return { kind: 'out-of-bounds', message: 'that would leave the bottom of the grid' }
  }

  const clash = placements.find(
    (placement) => placement.id !== id && overlaps(placement.rect, rect),
  )

  return clash ? { kind: 'overlap', withId: clash.id } : null
}

/** Top to bottom, left to right: the first place the new widget fits. */
export function findFreeSlot(
  placements: ReadonlyArray<Placement>,
  size: { w: number; h: number },
  columns: number,
): Rect | null {
  for (let y = 0; y + size.h <= CONFIG_LIMITS.MAX_GRID_ROWS; y += 1) {
    for (let x = 0; x + size.w <= columns; x += 1) {
      const rect = { x, y, w: size.w, h: size.h }
      if (!placements.some((placement) => overlaps(placement.rect, rect))) return rect
    }
  }

  return null
}

function overlaps(left: Rect, right: Rect) {
  return (
    left.x < right.x + right.w &&
    right.x < left.x + left.w &&
    left.y < right.y + right.h &&
    right.y < left.y + left.h
  )
}

/** Reads the placements out of draft entries, which may not all be valid widgets yet. */
export function placementsOf(entries: ReadonlyArray<unknown>): Placement[] {
  return entries.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.id !== 'string') return []

    const layout = entry.layout
    if (!isRecord(layout)) return []

    const { x, y, w, h } = layout
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof w !== 'number' ||
      typeof h !== 'number'
    ) {
      return []
    }

    return [{ id: entry.id, rect: { x, y, w, h } }]
  })
}
