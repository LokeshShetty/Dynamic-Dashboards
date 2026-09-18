import { useEffect, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

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

const DIRECTIONS: Record<string, { x: number; y: number } | undefined> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
}

/**
 * Edit chrome around a tile. The toolbar sits in its own row above the widget rather than over
 * it, so the title stays readable while the tile is being arranged.
 *
 * Moving and resizing are gestures on the grid itself: drag the handle, drag the corner. The
 * arrow keys do the same things while focus is in the tile, because a dashboard that can only be
 * arranged with a pointer cannot be arranged by everyone.
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

  useEffect(() => {
    actionsRef.current = actions
  }, [actions])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onKeyDown = (event: KeyboardEvent) => {
      const step = DIRECTIONS[event.key]
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

  return (
    <div
      ref={containerRef}
      onFocusCapture={onSelect}
      onPointerDownCapture={onSelect}
      className={cn(
        'flex min-h-0 w-full flex-col gap-1 rounded-lg border border-dashed p-1 transition-colors',
        isSelected ? 'border-accent bg-surface-muted/40' : 'border-border',
      )}
    >
      <div className="flex justify-end">
        <WidgetToolbar
          title={title}
          position={describedPosition}
          onRename={actions.onRename}
          onEdit={actions.onEdit}
          onDuplicate={actions.onDuplicate}
          onRemove={actions.onRemove}
        />
      </div>

      <div className="flex min-h-0 flex-1">{children}</div>
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
