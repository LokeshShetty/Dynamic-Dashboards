import { type ReactNode } from 'react'

import { GridLayout, noCompactor, useContainerWidth, type Layout } from 'react-grid-layout'

import { cn } from '@/lib/utils'

import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

import { GRID_FALLBACK_WIDTH, GRID_MARGIN, GRID_ROW_HEIGHT } from '../../_constants'

export type GridPlacement = {
  key: string
  x: number
  y: number
  w: number
  h: number
  minW: number
  minH: number
  maxW: number
  maxH: number
}

type Props = {
  columns: number
  placements: GridPlacement[]
  isEditable: boolean
  onLayoutChange?: (layout: Layout) => void
  children: ReactNode
  className?: string
}

/**
 * The 12 column grid the configuration places widgets on.
 *
 * In edit mode the same grid is dragged and resized directly, with a placeholder showing where a
 * tile will land and per widget minimum sizes so a table cannot be dragged down to a sliver.
 * Dragging is limited to the handle in each tile's toolbar, so a table's own controls keep
 * working, and nothing is compacted: a dashboard should look the way it was arranged rather than
 * the way an algorithm tidied it.
 *
 * Whatever comes back out is still checked against the loader's rules before it reaches the
 * draft. The library moves tiles; it does not get to decide what is a valid layout.
 */
export function WidgetGrid({
  columns,
  placements,
  isEditable,
  onLayoutChange,
  children,
  className,
}: Props) {
  const { width, containerRef } = useContainerWidth()

  return (
    <div ref={containerRef} className={cn('w-full', className)}>
      <GridLayout
        width={width > 0 ? width : GRID_FALLBACK_WIDTH}
        layout={placements.map(({ key, ...rect }) => ({ i: key, ...rect }))}
        gridConfig={{
          cols: columns,
          rowHeight: GRID_ROW_HEIGHT,
          margin: GRID_MARGIN,
          containerPadding: [0, 0],
        }}
        dragConfig={{ enabled: isEditable, bounded: true, handle: '.widget-drag-handle' }}
        resizeConfig={{ enabled: isEditable, handles: isEditable ? ['se'] : [] }}
        compactor={noCompactor}
        onLayoutChange={onLayoutChange}
      >
        {children}
      </GridLayout>
    </div>
  )
}
