import { useState } from 'react'

import { GitCompare } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog } from '@/components/ui/dialog'
import { CONFLICT_CHANGE_LABELS } from '@/dashboard/_constants'

import { diffConfigs } from '../_lib/diff'
import type { DashboardRecord } from '../_types'

type Props = {
  current: DashboardRecord
  mine: string
  expectedVersion: number
  isSaving: boolean
  onReloadTheirs: () => void
  onOverwrite: () => void
  onKeepEditing: () => void
}

/**
 * What a conflict is here: the stored version moved while this draft was being edited. Nothing
 * is merged and nothing is chosen automatically, because either choice loses someone's work and
 * only the person looking at both can say which loss is acceptable.
 */
export function SaveConflictDialog({
  current,
  mine,
  expectedVersion,
  isSaving,
  onReloadTheirs,
  onOverwrite,
  onKeepEditing,
}: Props) {
  const [isConfirmingOverwrite, setIsConfirmingOverwrite] = useState(false)
  const diff = diffConfigs(current.config, mine)

  return (
    <>
      <Dialog
        open
        onClose={onKeepEditing}
        title="This dashboard was saved by someone else"
        description={`You started from version ${expectedVersion}. The stored version is now ${current.version}, saved ${new Date(current.savedAt).toLocaleString()}.`}
        footer={
          <>
            <Button onClick={onKeepEditing} disabled={isSaving}>
              Keep editing
            </Button>
            <Button onClick={onReloadTheirs} disabled={isSaving}>
              Reload theirs
            </Button>
            <Button
              variant="danger"
              onClick={() => setIsConfirmingOverwrite(true)}
              disabled={isSaving}
            >
              Overwrite with mine
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-fg-muted inline-flex items-center gap-2 text-sm">
            <GitCompare aria-hidden="true" className="size-4" />
            {diff.widgets.length === 0 && !diff.settingsDiffer
              ? 'The widgets are identical, so only the save counter differs.'
              : 'What differs between the saved version and your draft:'}
          </p>

          {diff.settingsDiffer ? (
            <p className="border-warning bg-warning-surface text-fg rounded-md border p-2 text-xs">
              Dashboard settings differ, such as the title, dataset or filters.
            </p>
          ) : null}

          {diff.widgets.length > 0 ? (
            <ul className="border-border divide-border divide-y rounded-md border text-sm">
              {diff.widgets.map((change) => (
                <li key={change.id} className="flex items-center justify-between gap-3 p-2">
                  <span className="text-fg truncate">{change.title}</span>
                  <span className="text-fg-muted shrink-0 text-xs">
                    {CONFLICT_CHANGE_LABELS[change.change]}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Dialog>

      <ConfirmDialog
        open={isConfirmingOverwrite}
        title="Overwrite the saved version?"
        description={`Version ${current.version} was saved by someone else. Overwriting keeps your draft and theirs stays in the history as a revision.`}
        confirmLabel="Overwrite"
        isPending={isSaving}
        onConfirm={() => {
          setIsConfirmingOverwrite(false)
          onOverwrite()
        }}
        onCancel={() => setIsConfirmingOverwrite(false)}
      />
    </>
  )
}
