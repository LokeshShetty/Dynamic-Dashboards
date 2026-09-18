import { AlertOctagon } from 'lucide-react'
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router'

import { Button } from '@/components/ui/button'
import { log } from '@/lib/log'

/**
 * The last boundary in the app. Widgets have their own, and the dashboard has a screen for every
 * way a configuration can fail, so anything that reaches here is a bug rather than a handled
 * state. It still owes the reader the reason and a way out instead of a blank page.
 */
export function RouteErrorScreen() {
  const error = useRouteError()
  const navigate = useNavigate()

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'something threw a value that was not an error'

  log.error('route.crashed', { message })

  return (
    <main role="alert" className="mx-auto flex min-h-dvh max-w-2xl flex-col items-start gap-4 p-8">
      <h1 className="text-fg flex items-center gap-2 text-xl font-semibold">
        <AlertOctagon aria-hidden="true" className="text-danger size-5" />
        This page crashed
      </h1>

      <p className="text-fg-muted text-sm">
        Something threw where nothing was meant to: <code className="text-fg">{message}</code>. Your
        saved dashboards are untouched, and any unsaved draft is still in this tab until it is
        reloaded.
      </p>

      {error instanceof Error && error.stack !== undefined ? (
        <details className="w-full">
          <summary className="text-fg-muted cursor-pointer text-sm">Stack</summary>
          <pre className="border-border bg-surface-muted text-fg-muted mt-2 max-h-72 overflow-auto rounded-md border p-3 text-xs">
            {error.stack}
          </pre>
        </details>
      ) : null}

      <div className="flex gap-2">
        <Button variant="solid" onClick={() => void navigate(0)}>
          Reload this page
        </Button>
        <Button onClick={() => void navigate('/d/demo')}>Back to the demo dashboard</Button>
      </div>
    </main>
  )
}
