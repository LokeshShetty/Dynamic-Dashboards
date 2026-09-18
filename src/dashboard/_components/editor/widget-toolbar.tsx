import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronsLeftRight,
  ChevronsUpDown,
  Copy,
  Move,
  Pencil,
  Trash2,
  Type,
} from 'lucide-react'

import { Button } from '@/components/ui/button'

type Props = {
  title: string
  /** Read out with the move handle, so a keyboard user knows where the tile currently sits. */
  position: string
  /** Moving and resizing appear on the tile being worked on, so the others stay readable. */
  isSelected: boolean
  onRename: () => void
  onEdit: () => void
  onDuplicate: () => void
  onRemove: () => void
  onMove: (dx: number, dy: number) => void
  onResize: (dw: number, dh: number) => void
}

/** Every control is an icon button with a name that says which widget it acts on. */
export function WidgetToolbar({
  title,
  position,
  isSelected,
  onRename,
  onEdit,
  onDuplicate,
  onRemove,
  onMove,
  onResize,
}: Props) {
  return (
    <div className="border-border bg-surface-raised flex items-center gap-0.5 rounded-md border p-0.5 shadow-sm">
      <Button
        variant="ghost"
        size="sm"
        aria-label={`${title}: ${position}. Arrow keys move it, shift and arrow keys resize it.`}
        title="Arrow keys move this tile, shift and arrow keys resize it"
      >
        <Move aria-hidden="true" className="size-3" />
      </Button>

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

          <span className="flex items-center" aria-hidden="true" title="Move">
            <ChevronsLeftRight className="text-fg-subtle size-3" />
          </span>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Move ${title} left`}
            onClick={() => onMove(-1, 0)}
          >
            <ArrowLeft aria-hidden="true" className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Move ${title} right`}
            onClick={() => onMove(1, 0)}
          >
            <ArrowRight aria-hidden="true" className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Move ${title} up`}
            onClick={() => onMove(0, -1)}
          >
            <ArrowUp aria-hidden="true" className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Move ${title} down`}
            onClick={() => onMove(0, 1)}
          >
            <ArrowDown aria-hidden="true" className="size-3" />
          </Button>

          <span className="bg-border mx-0.5 h-4 w-px" aria-hidden="true" />

          <span className="flex items-center" aria-hidden="true" title="Resize">
            <ChevronsUpDown className="text-fg-subtle size-3" />
          </span>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Make ${title} narrower`}
            onClick={() => onResize(-1, 0)}
          >
            <ArrowLeft aria-hidden="true" className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Make ${title} wider`}
            onClick={() => onResize(1, 0)}
          >
            <ArrowRight aria-hidden="true" className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Make ${title} shorter`}
            onClick={() => onResize(0, -1)}
          >
            <ArrowUp aria-hidden="true" className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Make ${title} taller`}
            onClick={() => onResize(0, 1)}
          >
            <ArrowDown aria-hidden="true" className="size-3" />
          </Button>
        </>
      ) : null}
    </div>
  )
}
