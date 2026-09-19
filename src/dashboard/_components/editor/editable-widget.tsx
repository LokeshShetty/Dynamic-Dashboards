import { useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { GRID_DIRECTIONS } from '../../_constants'
import { WidgetToolbar } from './widget-toolbar'

type Props = {
  title: string
  position: { x: number; y: number; w: number; h: number } | null
  isSelected: boolean
  onSelect: () => void
  actions: {
    onRename: () => void
    onEdit: () => void
    onDuplicate: () => void
    onRemove: () => void
    onMove: (dx: number, dy: number) => void
    onResize: (dw: number, dh: number) => void
  }
  children: ReactNode
}

/**
 * Edit chrome around a tile.
 *
 * A grid row is a fixed height, so the chrome cannot take a row of its own: a toolbar above the
 * widget is a toolbar taken out of the widget, and the numbers get cut in half. It floats over
 * the top right corner instead, where the title is not, and only while the tile is hovered or
 * being worked on.
 *
 * Moving and resizing are gestures on the grid: drag the handle, drag the corner. The arrow keys
 * do the same things while focus is in the tile, because a dashboard that can only be arranged
 * with a pointer cannot be arranged by everyone.
 */
export function EditableWidget({
  title,
  position,
  isSelected,
  onSelect,
  actions,
  children,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef(actions)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    actionsRef.current = actions
  }, [actions])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onKeyDown = (event: KeyboardEvent) => {
      const step = GRID_DIRECTIONS[event.key as keyof typeof GRID_DIRECTIONS] ?? null
      if (!step || isTypingTarget(event.target)) return

      event.preventDefault()

      if (event.shiftKey) actionsRef.current.onResize(step.x, step.y)
      else actionsRef.current.onMove(step.x, step.y)
    }

    container.addEventListener('keydown', onKeyDown)
    return () => container.removeEventListener('keydown', onKeyDown)
  }, [])

  const describedPosition = position
    ? `column ${position.x + 1}, row ${position.y + 1}, ${position.w} wide by ${position.h} tall`
    : 'not placed on the grid'

  const showsToolbar = isHovered || isSelected

  return (
    <div
      ref={containerRef}
      onFocusCapture={onSelect}
      onPointerDownCapture={onSelect}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      className={cn(
        'relative flex h-full min-h-0 w-full rounded-lg ring-offset-2 transition-shadow',
        isSelected ? 'ring-accent ring-2' : 'ring-border ring-1',
      )}
    >
      {children}

      <div
        className={cn(
          'absolute -top-3 right-2 z-20 transition-opacity',
          showsToolbar ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <WidgetToolbar
          title={title}
          position={describedPosition}
          isSelected={isSelected}
          onMove={actions.onMove}
          onResize={actions.onResize}
          onRename={actions.onRename}
          onEdit={actions.onEdit}
          onDuplicate={actions.onDuplicate}
          onRemove={actions.onRemove}
        />
      </div>
    </div>
  )
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  )
}
