import { useParams } from 'react-router'

import { ChaosPanel } from '@/chaos/_components/chaos-panel'

/** Placeholder shell. The configuration renderer replaces this in the next phase. */
export function DashboardRoute() {
  const { id } = useParams()

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-2 p-8">
      <h1 className="text-fg text-xl font-semibold">Configurable dashboard</h1>
      <p className="text-fg-muted text-sm">
        Dashboard <code className="text-fg">{id}</code> renders here once the widget frame and the
        four widget types land. The data layer underneath is live: open the chaos panel, or drive it
        from the console with <code className="text-fg">window.__chaos</code>.
      </p>
      <ChaosPanel />
    </main>
  )
}
