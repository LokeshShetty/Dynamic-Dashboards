import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  GripVertical,
  Pencil,
  Trash2,
  Type,
} from 'lucide-react'

import { Button } from '@/components/ui/button'

import { TILE_MOVES, TILE_RESIZES } from '../../_constants'

type Props = {
  title: string
  /** Read out with the drag handle, so a keyboard user knows where the tile currently sits. */
  position: string
  /** Moving and resizing by button appear on the tile being worked on, not on all of them. */
  isSelected: boolean
  onMove: (dx: number, dy: number) => void
  onResize: (dw: number, dh: number) => void
  onRename: () => void
  onEdit: () => void
  onDuplicate: () => void
  onRemove: () => void
}

/**
 * The library's drag handle and resize grip are pointer only. These buttons, and the arrow keys
 * they mirror, are the path that does not need a pointer, so they are not decoration: they are
 * how the grid is arranged without a mouse. They appear on the tile being worked on, because
 * thirteen buttons on every tile is a wall rather than an editor.
 */
export function WidgetToolbar({
  title,
  position,
  isSelected,
  onMove,
  onResize,
  onRename,
  onEdit,
  onDuplicate,
  onRemove,
}: Props) {
  return (
    <div className="border-border bg-surface-raised flex items-center gap-0.5 rounded-md border p-0.5 shadow-sm">
      {/* The grid library drags by this class; the arrow keys do the same job from the tile. */}
      <button
        type="button"
        aria-label={`Move ${title}. ${position}. Drag to move, or use the arrow keys; shift and the arrow keys resize.`}
        title="Drag to move. Arrow keys move, shift and arrow keys resize."
        className="widget-drag-handle text-fg-muted hover:bg-surface-muted hover:text-fg focus-visible:outline-accent inline-flex h-7 cursor-grab touch-none items-center rounded-md px-2 active:cursor-grabbing focus-visible:outline-2"
      >
        <GripVertical aria-hidden="true" className="size-3" />
      </button>

      <Button variant="ghost" size="sm" aria-label={`Rename ${title}`} onClick={onRename}>
        <Type aria-hidden="true" className="size-3" />
      </Button>
      <Button variant="ghost" size="sm" aria-label={`Edit ${title}`} onClick={onEdit}>
        <Pencil aria-hidden="true" className="size-3" />
      </Button>
      <Button variant="ghost" size="sm" aria-label={`Duplicate ${title}`} onClick={onDuplicate}>
        <Copy aria-hidden="true" className="size-3" />
      </Button>
      <Button variant="ghost" size="sm" aria-label={`Remove ${title}`} onClick={onRemove}>
        <Trash2 aria-hidden="true" className="text-danger size-3" />
      </Button>

      {isSelected ? (
        <>
          <span className="bg-border mx-0.5 h-4 w-px" aria-hidden="true" />

          {TILE_MOVES.map((move) => (
            <Button
              key={move.label}
              variant="ghost"
              size="sm"
              aria-label={`Move ${title} ${move.label}`}
              onClick={() => onMove(move.x, move.y)}
            >
              <MoveIcon direction={move.label} />
            </Button>
          ))}

          <span className="bg-border mx-0.5 h-4 w-px" aria-hidden="true" />

          {TILE_RESIZES.map((resize) => (
            <Button
              key={resize.label}
              variant="ghost"
              size="sm"
              aria-label={`Make ${title} ${resize.label}`}
              onClick={() => onResize(resize.w, resize.h)}
            >
              <ResizeIcon direction={resize.label} />
            </Button>
          ))}
        </>
      ) : null}
    </div>
  )
}

/** The arrow that matches a direction, kept beside the buttons that use it. */
function MoveIcon({ direction }: { direction: (typeof TILE_MOVES)[number]['label'] }) {
  const Icon = { left: ArrowLeft, right: ArrowRight, up: ArrowUp, down: ArrowDown }[direction]
  return <Icon aria-hidden="true" className="size-3" />
}

function ResizeIcon({ direction }: { direction: (typeof TILE_RESIZES)[number]['label'] }) {
  const Icon = {
    narrower: ArrowLeft,
    wider: ArrowRight,
    shorter: ArrowUp,
    taller: ArrowDown,
  }[direction]

  return <Icon aria-hidden="true" className="size-3 opacity-70" />
}
