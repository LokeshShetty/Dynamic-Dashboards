import { useMemo, useState } from 'react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { isRecord } from '@/lib/guards'
import { useAppStore } from '@/lib/store'

import { useEditor } from '../../_hooks/use-editor'
import { loadDashboardConfig } from '../../_lib/load-config'
import type { WidgetFilterContext, WidgetSlot } from '../../_types'
import { DashboardErrorScreen } from '../dashboard-error-screen'
import { DashboardGrid } from '../dashboard-grid'
import { EditableWidget } from './editable-widget'
import { EditorBar } from './editor-bar'
import { RenameDialog } from './rename-dialog'
import { WidgetEditorDialog } from './widget-editor-dialog'

type EditorDialog =
  | { kind: 'edit'; index: number }
  | { kind: 'rename'; index: number }
  | { kind: 'remove'; index: number }
  | { kind: 'discard' }
  | { kind: 'leave' }

type Props = {
  filters: WidgetFilterContext
  onLeave: () => void
}

/**
 * Editing happens on the dashboard itself, on a draft that the loaded configuration never sees.
 * The draft is previewed through the same loader the reader gets, so a widget that is mid-edit
 * and not valid yet shows exactly the tile it would show if it were saved that way.
 */
export function EditorGrid({ filters, onLeave }: Props) {
  const editor = useEditor()
  const resetDraft = useAppStore((state) => state.resetDraft)
  const discardDraft = useAppStore((state) => state.discardDraft)
  const [dialog, setDialog] = useState<EditorDialog | null>(null)

  const shell = editor.shell
  const preview = useMemo(
    () => (shell === null ? null : loadDashboardConfig(JSON.stringify(shell))),
    [shell],
  )

  if (!shell || !preview) return null

  if (preview.kind !== 'loaded') {
    return (
      <DashboardErrorScreen
        heading="This draft cannot be rendered"
        message={
          preview.kind === 'invalid'
            ? preview.error.message
            : 'the draft claims a configuration format this build does not support'
        }
        issues={preview.kind === 'invalid' ? preview.error.issues : undefined}
        rawText={preview.rawText}
      />
    )
  }

  const entryAt = (index: number) => shell.widgets[index]
  const titleAt = (index: number) => {
    const entry = entryAt(index)
    return isRecord(entry) && typeof entry.title === 'string' ? entry.title : `widget ${index + 1}`
  }

  const leave = () => {
    discardDraft()
    onLeave()
  }

  return (
    <div className="flex flex-col gap-4">
      <EditorBar
        isDirty={editor.isDirty}
        onAdd={(kind) => {
          const index = editor.addWidget(kind)
          if (index !== null) setDialog({ kind: 'edit', index })
        }}
        onDiscard={() => setDialog({ kind: 'discard' })}
        onDone={() => (editor.isDirty ? setDialog({ kind: 'leave' }) : leave())}
      />

      <DashboardGrid
        shell={preview.shell}
        slots={preview.slots}
        filters={filters}
        wrapTile={(slot: WidgetSlot, tile) => (
          <EditableWidget
            title={titleAt(slot.index)}
            position={slot.kind === 'valid' ? slot.widget.layout : null}
            actions={{
              onRename: () => setDialog({ kind: 'rename', index: slot.index }),
              onEdit: () => setDialog({ kind: 'edit', index: slot.index }),
              onDuplicate: () => editor.duplicateWidget(slot.index),
              onRemove: () => setDialog({ kind: 'remove', index: slot.index }),
              onMove: (dx, dy) => editor.moveWidget(slot.index, dx, dy),
              onResize: (dw, dh) => editor.resizeWidget(slot.index, dw, dh),
            }}
          >
            {tile}
          </EditableWidget>
        )}
      />

      {dialog?.kind === 'edit' ? (
        <WidgetEditorDialog
          entry={entryAt(dialog.index)}
          dashboardDataset={shell.dataset}
          onChange={(values) => editor.updateWidget(dialog.index, values)}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog?.kind === 'rename' ? (
        <RenameDialog
          currentTitle={titleAt(dialog.index)}
          onRename={(title) => editor.renameWidget(dialog.index, title)}
          onClose={() => setDialog(null)}
        />
      ) : null}

      <ConfirmDialog
        open={dialog?.kind === 'remove'}
        title="Remove this widget?"
        description={
          dialog?.kind === 'remove'
            ? `“${titleAt(dialog.index)}” will be removed from the draft. Nothing is saved until you save the dashboard.`
            : ''
        }
        confirmLabel="Remove"
        onConfirm={() => {
          if (dialog?.kind === 'remove') editor.removeWidget(dialog.index)
          setDialog(null)
        }}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog?.kind === 'discard'}
        title="Discard your changes?"
        description="The dashboard goes back to how it was when you started editing."
        confirmLabel="Discard changes"
        onConfirm={() => {
          resetDraft()
          setDialog(null)
        }}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog?.kind === 'leave'}
        title="Leave editing with unsaved changes?"
        description="Saving is not built yet, so leaving now throws the draft away."
        confirmLabel="Leave and discard"
        onConfirm={() => {
          setDialog(null)
          leave()
        }}
        onCancel={() => setDialog(null)}
      />
    </div>
  )
}
