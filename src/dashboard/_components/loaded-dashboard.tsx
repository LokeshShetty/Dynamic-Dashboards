import { useEffect, useMemo } from 'react'

import { useQueryClient } from '@tanstack/react-query'
import { Database, History, Pencil, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'

import { useEditMode } from '../_hooks/use-edit-mode'
import { useFilterValues } from '../_hooks/use-filter-values'
import type { DashboardShell } from '../_lib/config.schema'
import { toDataFilters } from '../_lib/to-data-query'
import type { WidgetSlot } from '../_types'
import { DashboardGrid } from './dashboard-grid'
import { EditorGrid } from './editor/editor-grid'
import { FilterBar } from './filters/filter-bar'

type Props = {
  shell: DashboardShell
  slots: WidgetSlot[]
  migratedFrom: number | null
}

export function LoadedDashboard({ shell, slots, migratedFrom }: Props) {
  const queryClient = useQueryClient()
  const { values, activeCount, ignored, setValue, reset } = useFilterValues(shell.filters)
  const { isEditing, enterEditMode, leaveEditMode } = useEditMode()
  const startDraft = useAppStore((state) => state.startDraft)
  const discardDraft = useAppStore((state) => state.discardDraft)

  // The draft is taken from the loaded configuration when editing starts, and thrown away when
  // it ends. Nothing in edit mode touches what the reader sees until a save exists.
  useEffect(() => {
    if (isEditing) startDraft(shell.id, shell)
    else discardDraft()
  }, [discardDraft, isEditing, shell, startDraft])

  const filterContext = useMemo(
    () => ({
      applied: toDataFilters(shell.filters, values),
      labels: Object.fromEntries(shell.filters.map((filter) => [filter.field, filter.label])),
    }),
    [shell.filters, values],
  )

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['widget-data', shell.id] })
  }

  return (
    <div className="mx-auto flex max-w-[110rem] flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-fg text-xl font-semibold">{shell.title}</h1>
          <p className="text-fg-muted flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1">
              <Database aria-hidden="true" className="size-3" />
              {shell.dataset}
            </span>
            <span>
              {slots.length} widget{slots.length === 1 ? '' : 's'}
            </span>
            <span>saved version {shell.version}</span>
            {migratedFrom === null ? null : (
              <span className="text-fg inline-flex items-center gap-1">
                <History aria-hidden="true" className="size-3" />
                opened from configuration format {migratedFrom}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? null : (
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

      <FilterBar
        filters={shell.filters}
        dataset={shell.dataset}
        values={values}
        activeCount={activeCount}
        ignored={ignored}
        onChange={setValue}
        onReset={reset}
      />

      {isEditing ? (
        <EditorGrid filters={filterContext} onLeave={leaveEditMode} />
      ) : (
        <DashboardGrid shell={shell} slots={slots} filters={filterContext} />
      )}
    </div>
  )
}
