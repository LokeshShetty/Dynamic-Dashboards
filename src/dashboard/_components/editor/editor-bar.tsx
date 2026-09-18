import { Check, PencilLine, Save, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { WidgetKind } from '../../_constants'
import { AddWidgetMenu } from './add-widget-menu'

type Props = {
  isDirty: boolean
  savedVersion: number | null
  isSaving: boolean
  onSave: () => void
  onAdd: (kind: WidgetKind) => void
  onDiscard: () => void
  onDone: () => void
}

/**
 * Saving follows the same contract as every other action that waits on something: it shows that
 * it is working, it cannot be pressed twice, and it says what happened either way. A save that
 * fails leaves the draft dirty and the changes untouched.
 */
export function EditorBar({
  isDirty,
  savedVersion,
  isSaving,
  onSave,
  onAdd,
  onDiscard,
  onDone,
}: Props) {
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
          {isDirty ? 'Unsaved changes' : `Saved as version ${savedVersion ?? '?'}`}
        </span>

        <Button
          size="sm"
          variant="solid"
          onClick={onSave}
          disabled={isSaving || !isDirty || savedVersion === null}
          title={
            savedVersion === null
              ? 'Waiting for the stored version this edit started from'
              : undefined
          }
        >
          <Save aria-hidden="true" className="size-3" />
          {isSaving ? 'Saving…' : isDirty ? 'Save' : 'Saved'}
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
