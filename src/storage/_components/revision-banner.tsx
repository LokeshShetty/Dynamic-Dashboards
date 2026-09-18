import { History, RotateCcw, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { RevisionRecord } from '../_types'

type Props = {
  revision: RevisionRecord
  isRestoring: boolean
  onRestore: () => void
  onLeave: () => void
}

export function RevisionBanner({ revision, isRestoring, onRestore, onLeave }: Props) {
  return (
    <output
      className="border-warning bg-warning-surface text-fg flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"
      aria-label="Viewing a revision"
    >
      <span className="inline-flex items-center gap-2">
        <History aria-hidden="true" className="size-4" />
        Viewing revision {revision.position} of {revision.total}, saved as version{' '}
        {revision.version} on {new Date(revision.savedAt).toLocaleString()}. This view is read only.
      </span>

      <span className="ml-auto flex items-center gap-2">
        <Button size="sm" onClick={onRestore} disabled={isRestoring}>
          <RotateCcw aria-hidden="true" className="size-3" />
          {isRestoring ? 'Restoring…' : 'Restore this revision'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onLeave}>
          <X aria-hidden="true" className="size-3" />
          Back to current
        </Button>
      </span>
    </output>
  )
}
