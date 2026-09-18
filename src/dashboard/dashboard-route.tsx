import { useMemo } from 'react'

import { useParams } from 'react-router'

import { ChaosPanel } from '@/chaos/_components/chaos-panel'

import { DashboardErrorScreen } from './_components/dashboard-error-screen'
import { DashboardView } from './_components/dashboard-view'
import v1Text from './_fixtures/dashboard-v1.json?raw'
import v2Text from './_fixtures/dashboard-v2.json?raw'
import v3Text from './_fixtures/dashboard-v3.json?raw'
import { loadDashboardConfig } from './_lib/load-config'

/**
 * Until saved dashboards land, the route id picks one of the shipped configurations. The two
 * legacy ones are here on purpose: they are written in older formats and still open.
 */
const CONFIGURATIONS: Record<string, string> = {
  demo: v3Text,
  'legacy-v2': v2Text,
  'legacy-v1': v1Text,
}

export function DashboardRoute() {
  const { id = 'demo' } = useParams()
  const rawText = CONFIGURATIONS[id]

  const load = useMemo(
    () => (rawText === undefined ? null : loadDashboardConfig(rawText)),
    [rawText],
  )

  return (
    <main className="min-h-dvh">
      {load ? (
        <DashboardView load={load} />
      ) : (
        <DashboardErrorScreen
          heading="No dashboard with that id"
          message={`Nothing is saved under "${id}". The shipped ones are ${Object.keys(CONFIGURATIONS).join(', ')}.`}
        />
      )}
      <ChaosPanel />
    </main>
  )
}
