import { Check, PencilLine, Save, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { WidgetKind } from '../../_constants'
import { AddWidgetMenu } from './add-widget-menu'

type Props = {
  isDirty: boolean
  onAdd: (kind: WidgetKind) => void
  onDiscard: () => void
  onDone: () => void
}

/**
 * Save is here and visibly disabled rather than hidden, because a dashboard editor without a
 * save button reads as broken. The tooltip says what it is waiting for.
 */
export function EditorBar({ isDirty, onAdd, onDiscard, onDone }: Props) {
  return (
    <section
      aria-label="Editing"
      className="border-accent bg-surface-muted flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3"
    >
      <span className="text-fg inline-flex items-center gap-1 text-sm font-medium">
        <PencilLine aria-hidden="true" className="size-4" />
        Editing
      </span>

      <AddWidgetMenu onAdd={onAdd} />

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <span className={isDirty ? 'text-warning text-xs' : 'text-fg-subtle text-xs'}>
          {isDirty ? 'Unsaved changes' : 'No changes yet'}
        </span>

        <Button
          size="sm"
          variant="solid"
          disabled
          title="Saving arrives with persistence in the next phase"
        >
          <Save aria-hidden="true" className="size-3" />
          Save
        </Button>

        <Button size="sm" onClick={onDiscard} disabled={!isDirty}>
          <Undo2 aria-hidden="true" className="size-3" />
          Discard changes
        </Button>

        <Button size="sm" onClick={onDone}>
          <Check aria-hidden="true" className="size-3" />
          Done
        </Button>
      </div>
    </section>
  )
}
