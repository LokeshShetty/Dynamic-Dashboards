import { Check, CircleAlert, PencilLine, Save, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { WidgetKind } from '../../_constants'
import type { SaveBlocker } from '../../_types'
import { AddWidgetMenu } from './add-widget-menu'

type Props = {
  isDirty: boolean
  savedVersion: number | null
  /** Set when saving is not possible, so the disabled button is never the only explanation. */
  saveBlocker: SaveBlocker | null
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
  saveBlocker,
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
        {saveBlocker === null ? (
          <span className={isDirty ? 'text-warning text-xs' : 'text-fg-subtle text-xs'}>
            {isDirty ? 'Unsaved changes' : `Saved as version ${savedVersion ?? '?'}`}
          </span>
        ) : (
          <span
            {...(saveBlocker.kind === 'blocked' ? { role: 'alert' } : {})}
            className={cn(
              'inline-flex max-w-sm items-center gap-1 text-xs',
              saveBlocker.kind === 'blocked' ? 'text-danger' : 'text-fg-subtle',
            )}
          >
            <CircleAlert aria-hidden="true" className="size-3 shrink-0" />
            {saveBlocker.message}
          </span>
        )}

        <Button
          size="sm"
          variant="solid"
          onClick={onSave}
          disabled={isSaving || !isDirty || savedVersion === null}
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
