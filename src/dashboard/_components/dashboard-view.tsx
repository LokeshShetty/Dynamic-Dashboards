import type { DashboardLoad } from '../_types'
import { DashboardErrorScreen } from './dashboard-error-screen'
import { LoadedDashboard } from './loaded-dashboard'
import { UnsupportedVersionScreen } from './unsupported-version-screen'

type Props = {
  load: DashboardLoad
  saved: { version: number; savedAt: string; config: string; revisionCount: number }
  readOnly?: boolean
}

/** Every way a configuration can arrive, and the screen that owes the reader an explanation. */
export function DashboardView({ load, saved, readOnly = false }: Props) {
  switch (load.kind) {
    case 'invalid':
      return (
        <DashboardErrorScreen
          heading="This dashboard cannot be opened"
          message={load.error.message}
          issues={load.error.issues}
          rawText={load.rawText}
        />
      )

    case 'unsupported-version':
      return (
        <UnsupportedVersionScreen
          found={load.found}
          supported={load.supported}
          rawText={load.rawText}
        />
      )

    case 'loaded':
      return (
        <LoadedDashboard
          shell={load.shell}
          filters={load.filters}
          droppedFilters={load.droppedFilters}
          slots={load.slots}
          migratedFrom={load.migratedFrom}
          saved={saved}
          readOnly={readOnly}
        />
      )
  }
}
