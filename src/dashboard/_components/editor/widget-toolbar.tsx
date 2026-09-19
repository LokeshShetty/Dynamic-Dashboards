import { Copy, GripVertical, Pencil, Trash2, Type } from 'lucide-react'

import { Button } from '@/components/ui/button'

type Props = {
  title: string
  /** Read out with the drag handle, so a keyboard user knows where the tile currently sits. */
  position: string
  onRename: () => void
  onEdit: () => void
  onDuplicate: () => void
  onRemove: () => void
}

/**
 * What can be done to a tile, in one short row that fits inside the narrowest tile the grid
 * allows. Moving and resizing are not here: they are the drag handle for a pointer and the arrow
 * keys for a keyboard, which the handle's label spells out, because a row of thirteen buttons
 * was wider than the tile it belonged to and spilled over its neighbours.
 */
export function WidgetToolbar({ title, position, onRename, onEdit, onDuplicate, onRemove }: Props) {
  return (
    <div className="border-border bg-surface-raised flex max-w-full flex-wrap items-center justify-end gap-0.5 rounded-md border p-0.5 shadow-sm">
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
    </div>
  )
}
