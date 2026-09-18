import type { ReactNode } from 'react'

import type { Layout } from 'react-grid-layout'

import type { DashboardShell } from '../_lib/config.schema'
import { gridKeyFor, toGridPlacements } from '../_lib/grid-placement'
import type { WidgetFilterContext, WidgetSlot } from '../_types'
import { WidgetGrid } from './widget-grid'
import { WidgetRenderer } from './widget-renderer'

type Props = {
  shell: DashboardShell
  slots: WidgetSlot[]
  filters: WidgetFilterContext
  /** Edit mode wraps each tile in its own chrome; reading mode wraps nothing. */
  wrapTile?: (slot: WidgetSlot, tile: ReactNode) => ReactNode
  isEditable?: boolean
  onLayoutChange?: (layout: Layout) => void
}

export function DashboardGrid({
  shell,
  slots,
  filters,
  wrapTile,
  isEditable = false,
  onLayoutChange,
}: Props) {
  return (
    <WidgetGrid
      columns={shell.layout.columns}
      placements={toGridPlacements(slots)}
      isEditable={isEditable}
      onLayoutChange={onLayoutChange}
    >
      {slots.map((slot) => {
        const tile = (
          <WidgetRenderer
            dashboardId={shell.id}
            dataset={shell.dataset}
            slot={slot}
            rawEntry={shell.widgets[slot.index]}
            filters={filters}
          />
        )

        return (
          <div key={gridKeyFor(slot.index)} className="flex min-h-0">
            {wrapTile ? wrapTile(slot, tile) : tile}
          </div>
        )
      })}
    </WidgetGrid>
  )
}
