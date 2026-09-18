import type { ReactNode } from 'react'

import { FileWarning } from 'lucide-react'

import type { ConfigIssue } from '../_types'

type Props = {
  heading: string
  message: string
  issues?: ConfigIssue[]
  rawText?: string
  /** A way forward, where there is one: retry, reset, create. */
  action?: ReactNode
}

/**
 * A dashboard that cannot be loaded at all still owes the reader the reason and their own
 * configuration back. A blank screen would leave them with neither.
 */
export function DashboardErrorScreen({ heading, message, issues, rawText, action }: Props) {
  return (
    <div role="alert" className="mx-auto flex max-w-3xl flex-col gap-4 p-8">
      <h1 className="text-fg flex items-center gap-2 text-xl font-semibold">
        <FileWarning aria-hidden="true" className="text-danger size-5" />
        {heading}
      </h1>

      <p className="text-fg-muted text-sm">{message}</p>

      {action === undefined ? null : <div className="flex gap-2">{action}</div>}

      {issues && issues.length > 0 ? (
        <ul className="border-danger bg-danger-surface text-fg flex flex-col gap-1 rounded-md border p-3 text-sm">
          {issues.map((issue) => (
            <li key={`${issue.path}:${issue.message}`}>
              <code className="text-fg">{issue.path === '' ? 'configuration' : issue.path}</code>{' '}
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}

      {rawText === undefined ? null : (
        <details open>
          <summary className="text-fg-muted cursor-pointer text-sm">
            The configuration as it was saved
          </summary>
          <pre className="border-border bg-surface-muted text-fg-muted mt-2 max-h-96 overflow-auto rounded-md border p-3 text-xs">
            {rawText}
          </pre>
        </details>
      )}
    </div>
  )
}
