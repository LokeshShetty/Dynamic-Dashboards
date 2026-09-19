import type { DashboardLoad } from '../_types'
import { DashboardErrorScreen } from './dashboard-error-screen'
import { LoadedDashboard } from './loaded-dashboard'
import { UnsupportedVersionScreen } from './unsupported-version-screen'

type Props = {
  /**
   * The id this dashboard is stored under, which is not always the id written inside the
   * configuration: an imported file brings its own, and a hand edited record can disagree with
   * its own key. Storage is addressed by this one.
   */
  dashboardId: string
  load: DashboardLoad
  saved: { version: number; savedAt: string; config: string; revisionCount: number }
  readOnly?: boolean
}

/** Every way a configuration can arrive, and the screen that owes the reader an explanation. */
export function DashboardView({ dashboardId, load, saved, readOnly = false }: Props) {
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
          dashboardId={dashboardId}
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
