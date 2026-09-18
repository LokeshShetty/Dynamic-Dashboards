import { useEffect, useMemo } from 'react'

import { useQueryClient } from '@tanstack/react-query'
import { Database, History, Pencil, RefreshCw, Save } from 'lucide-react'

import { BidiText } from '@/components/ui/bidi-text'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { isDraftDirty } from '@/lib/store/slices/draft.slice'
import { SaveNoticeBanner } from '@/storage/_components/save-notice-banner'
import { dashboardQueryKey } from '@/storage/_hooks/use-dashboard-record'
import { useSaveNotices } from '@/storage/_hooks/use-save-notices'

import { useEditMode } from '../_hooks/use-edit-mode'
import { useFilterValues } from '../_hooks/use-filter-values'
import type { DashboardFilter, DashboardShell } from '../_lib/config.schema'
import { toDataFilters } from '../_lib/to-data-query'
import type { DroppedFilter, WidgetSlot } from '../_types'
import { DashboardGrid } from './dashboard-grid'
import { DashboardTransfer } from './dashboard-transfer'
import { EditorGrid } from './editor/editor-grid'
import { FilterBar } from './filters/filter-bar'

type Props = {
  shell: DashboardShell
  filters: DashboardFilter[]
  droppedFilters: DroppedFilter[]
  slots: WidgetSlot[]
  migratedFrom: number | null
  /** What the store says about this dashboard, so the header can show where the save is. */
  saved: { version: number; savedAt: string; config: string; revisionCount: number }
  /** Revisions and hostile files are shown, not edited: no editing, no import, no export. */
  readOnly?: boolean
}

export function LoadedDashboard({
  shell,
  filters,
  droppedFilters,
  slots,
  migratedFrom,
  saved,
  readOnly = false,
}: Props) {
  const queryClient = useQueryClient()
  const { values, activeCount, ignored, setValue, reset } = useFilterValues(filters)
  const { isEditing, enterEditMode, leaveEditMode } = useEditMode()
  const startDraft = useAppStore((state) => state.startDraft)
  const discardDraft = useAppStore((state) => state.discardDraft)
  const draft = useAppStore((state) => state.draft)
  const draftBaseline = useAppStore((state) => state.draftBaseline)
  const { notice, dismiss } = useSaveNotices(shell.id)
  const isDirty = isDraftDirty(draft, draftBaseline)

  const reloadSaved = () => {
    dismiss()
    void queryClient.invalidateQueries({ queryKey: dashboardQueryKey(shell.id) })
  }

  // The draft is taken from the loaded configuration when editing starts, and thrown away when
  // it ends. Nothing in edit mode touches what the reader sees until a save exists.
  useEffect(() => {
    if (isEditing) startDraft(shell.id, shell)
    else discardDraft()
  }, [discardDraft, isEditing, shell, startDraft])

  const filterContext = useMemo(
    () => ({
      applied: toDataFilters(filters, values),
      labels: Object.fromEntries(filters.map((filter) => [filter.field, filter.label])),
    }),
    [filters, values],
  )

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['widget-data', shell.id] })
  }

  return (
    <div className="mx-auto flex max-w-[110rem] flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-fg text-xl font-semibold">
            <BidiText>{shell.title}</BidiText>
          </h1>
          <p className="text-fg-muted flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1">
              <Database aria-hidden="true" className="size-3" />
              {shell.dataset}
            </span>
            <span>
              {slots.length} widget{slots.length === 1 ? '' : 's'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Save aria-hidden="true" className="size-3" />
              saved version {saved.version}
            </span>
            <span>
              {saved.revisionCount} revision{saved.revisionCount === 1 ? '' : 's'} kept
            </span>
            {migratedFrom === null ? null : (
              <span className="text-fg inline-flex items-center gap-1">
                <History aria-hidden="true" className="size-3" />
                opened from configuration format {migratedFrom}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {readOnly ? null : (
            <DashboardTransfer
              dashboardId={shell.id}
              config={saved.config}
              onImported={enterEditMode}
            />
          )}
          {isEditing || readOnly ? null : (
            <Button onClick={enterEditMode}>
              <Pencil aria-hidden="true" className="size-4" />
              Edit dashboard
            </Button>
          )}
          <Button onClick={refreshAll}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh all
          </Button>
        </div>
      </header>

      {notice === null ? null : (
        <SaveNoticeBanner
          notice={notice}
          isDirty={isDirty}
          onReload={reloadSaved}
          onCompare={enterEditMode}
          onDismiss={dismiss}
        />
      )}

      <FilterBar
        filters={filters}
        dropped={droppedFilters}
        dataset={shell.dataset}
        values={values}
        activeCount={activeCount}
        ignored={ignored}
        onChange={setValue}
        onReset={reset}
      />

      {isEditing && !readOnly ? (
        <EditorGrid
          dashboardId={shell.id}
          filters={filterContext}
          onLeave={leaveEditMode}
          onReloadSaved={reloadSaved}
        />
      ) : (
        <DashboardGrid shell={shell} slots={slots} filters={filterContext} />
      )}
    </div>
  )
}
