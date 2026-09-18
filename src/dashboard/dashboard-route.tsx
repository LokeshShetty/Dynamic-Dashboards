import { useParams } from 'react-router'

/** Placeholder shell. The configuration renderer replaces this in a later phase. */
export function DashboardRoute() {
  const { id } = useParams()

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-2 p-8">
      <h1 className="text-fg text-xl font-semibold">Configurable dashboard</h1>
      <p className="text-fg-muted text-sm">
        Scaffold only. Dashboard <code className="text-fg">{id}</code> renders here once the
        configuration schema and renderer land.
      </p>
    </main>
  )
}
