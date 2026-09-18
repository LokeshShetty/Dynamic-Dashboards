import { useQueryClient } from '@tanstack/react-query'
import { Database, History, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { defaultFilterValues } from '../_lib/filter-values'
import { toDataFilters } from '../_lib/to-data-query'
import type { DashboardLoad } from '../_types'
import { DashboardErrorScreen } from './dashboard-error-screen'
import { UnsupportedVersionScreen } from './unsupported-version-screen'
import { WidgetGrid, WidgetGridItem } from './widget-grid'
import { WidgetRenderer } from './widget-renderer'

type Props = { load: DashboardLoad }

export function DashboardView({ load }: Props) {
  const queryClient = useQueryClient()

  if (load.kind === 'invalid') {
    return (
      <DashboardErrorScreen
        heading="This dashboard cannot be opened"
        message={load.error.message}
        issues={load.error.issues}
        rawText={load.rawText}
      />
    )
  }

  if (load.kind === 'unsupported-version') {
    return (
      <UnsupportedVersionScreen
        found={load.found}
        supported={load.supported}
        rawText={load.rawText}
      />
    )
  }

  const { shell, slots } = load
  const filters = toDataFilters(shell.filters, defaultFilterValues(shell.filters))

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
            {load.migratedFrom === null ? null : (
              <span className="text-fg inline-flex items-center gap-1">
                <History aria-hidden="true" className="size-3" />
                opened from configuration format {load.migratedFrom}
              </span>
            )}
          </p>
        </div>

        <Button onClick={refreshAll}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Refresh all
        </Button>
      </header>

      <WidgetGrid columns={shell.layout.columns}>
        {slots.map((slot) => (
          <WidgetGridItem
            key={`${slot.index}-${slot.kind === 'invalid' ? (slot.id ?? 'unnamed') : slot.id}`}
            layout={slot.kind === 'valid' ? slot.widget.layout : null}
          >
            <WidgetRenderer
              dashboardId={shell.id}
              dataset={shell.dataset}
              slot={slot}
              rawEntry={shell.widgets[slot.index]}
              filters={filters}
            />
          </WidgetGridItem>
        ))}
      </WidgetGrid>
    </div>
  )
}
