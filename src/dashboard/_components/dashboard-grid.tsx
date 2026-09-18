import type { ReactNode } from 'react'

import type { DashboardShell } from '../_lib/config.schema'
import type { WidgetFilterContext, WidgetSlot } from '../_types'
import { WidgetGrid, WidgetGridItem } from './widget-grid'
import { WidgetRenderer } from './widget-renderer'

type Props = {
  shell: DashboardShell
  slots: WidgetSlot[]
  filters: WidgetFilterContext
  /** Edit mode wraps each tile in its own chrome; reading mode wraps nothing. */
  wrapTile?: (slot: WidgetSlot, tile: ReactNode) => ReactNode
}

export function DashboardGrid({ shell, slots, filters, wrapTile }: Props) {
  return (
    <WidgetGrid columns={shell.layout.columns}>
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
          <WidgetGridItem
            key={`${slot.index}-${slot.kind}`}
            layout={slot.kind === 'valid' ? slot.widget.layout : null}
          >
            {wrapTile ? wrapTile(slot, tile) : tile}
          </WidgetGridItem>
        )
      })}
    </WidgetGrid>
  )
}
