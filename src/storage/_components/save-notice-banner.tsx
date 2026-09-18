import { RefreshCw, Users, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { SaveNotice } from '../_hooks/use-save-notices'

type Props = {
  notice: SaveNotice
  isDirty: boolean
  onReload: () => void
  onCompare: () => void
  onDismiss: () => void
}

/**
 * Another tab saved. If nothing is being edited here, reloading is one click. If there is a
 * draft, the offer is to compare rather than to reload, because reloading would take the
 * reader's own unsaved work with it.
 */
export function SaveNoticeBanner({ notice, isDirty, onReload, onCompare, onDismiss }: Props) {
  return (
    <output className="border-accent bg-surface-muted text-fg flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
      <span className="inline-flex items-center gap-2">
        <Users aria-hidden="true" className="size-4" />
        Someone saved version {notice.version} at{' '}
        {new Date(notice.savedAt).toLocaleTimeString(undefined, { hour12: false })}
        {isDirty ? '. You have unsaved changes here.' : '.'}
      </span>

      <span className="ml-auto flex items-center gap-2">
        {isDirty ? (
          <Button size="sm" onClick={onCompare}>
            Compare with mine
          </Button>
        ) : (
          <Button size="sm" onClick={onReload}>
            <RefreshCw aria-hidden="true" className="size-3" />
            Reload it
          </Button>
        )}
        <Button size="sm" variant="ghost" aria-label="Dismiss this notice" onClick={onDismiss}>
          <X aria-hidden="true" className="size-3" />
        </Button>
      </span>
    </output>
  )
}
