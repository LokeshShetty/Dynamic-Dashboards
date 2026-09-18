import { useEffect, useRef, type ReactNode } from 'react'

import { WidgetToolbar } from './widget-toolbar'

type Props = {
  title: string
  position: { x: number; y: number; w: number; h: number } | null
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
 * Edit chrome around a tile. The tile keeps rendering through the same frame, so what is being
 * arranged is the real widget in its real state, not a placeholder standing in for one.
 *
 * The toolbar and the keyboard do the same things: arrows move, shift and arrows resize, while
 * focus is anywhere in the tile. The move handle is the focus target that says so out loud, and
 * keys are ignored inside form controls so a table's own controls keep working.
 */
export function EditableWidget({ title, position, actions, children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef(actions)

  // The listener below is attached once, so it reads the current actions through a ref.
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
      className="border-accent/60 relative flex min-h-0 w-full rounded-lg border border-dashed p-1"
    >
      <div className="absolute -top-3 right-1 z-10">
        <WidgetToolbar title={title} position={describedPosition} {...actions} />
      </div>
      {children}
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
