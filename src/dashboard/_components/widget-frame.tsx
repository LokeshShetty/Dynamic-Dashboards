import type { ReactNode } from 'react'

import { AlertTriangle, Check, FileWarning, History, Inbox, RefreshCw, Unlink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { formatClockTime } from '../_lib/format'
import type { WidgetState } from '../_types'
import { WidgetBadge } from './widget-badge'
import { WidgetConfigDisclosure } from './widget-config-disclosure'
import { WidgetErrorBoundary } from './widget-error-boundary'
import { WidgetStateNotice } from './widget-state-notice'

type Props<TResult> = {
  title: string
  widgetId: string
  state: WidgetState<TResult>
  skeleton: ReactNode
  configText: string
  onRefresh: () => void
  children: (result: TResult) => ReactNode
  className?: string
}

/**
 * The only component that renders widget states. A widget body is handed data or it is not
 * rendered at all, which is what keeps the promise enforceable: there is exactly one place
 * where "showing the truth" and "visibly showing that it cannot" are decided.
 */
export function WidgetFrame<TResult>({
  title,
  widgetId,
  state,
  skeleton,
  configText,
  onRefresh,
  children,
  className,
}: Props<TResult>) {
  const retry = { label: 'Retry now', onRetry: onRefresh }

  return (
    <section
      aria-label={title}
      className={cn(
        'border-border bg-surface-raised flex h-full w-full min-h-0 flex-col gap-2 overflow-hidden rounded-lg border p-3',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-fg truncate text-sm font-semibold">{title}</h3>
          <StateBadge state={state} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Refresh ${title}`}
          onClick={onRefresh}
          disabled={isBusy(state)}
        >
          <RefreshCw aria-hidden="true" className="size-4" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <WidgetErrorBoundary widgetId={widgetId} onRetry={onRefresh}>
          {state.kind === 'invalid' ? (
            <WidgetStateNotice tone="danger" message={state.reason} issues={state.issues} />
          ) : null}

          {state.kind === 'unresolvable' ? (
            <WidgetStateNotice tone="warning" message={state.reason} />
          ) : null}

          {state.kind === 'error' ? (
            <WidgetStateNotice
              tone="danger"
              message={
                state.isRefreshing
                  ? `${state.reason}. Retrying (${state.attempt}/${state.maxAttempts})`
                  : state.reason
              }
              retry={retry}
            />
          ) : null}

          {state.kind === 'empty' ? (
            <WidgetStateNotice
              tone="neutral"
              message="No rows match the filters in force, so there is nothing to show."
              retry={retry}
            />
          ) : null}

          {state.kind === 'loading' ? skeleton : null}

          {state.kind === 'stale' ? (
            <>
              <WidgetStateNotice
                tone="warning"
                message={
                  state.isRefreshing
                    ? `Stale since ${formatClockTime(state.fetchedAt)}, retrying (${state.attempt}/${state.maxAttempts})`
                    : `Stale since ${formatClockTime(state.fetchedAt)}, refresh failed: ${state.reason}`
                }
                retry={retry}
              />
              <div className="pointer-events-none opacity-50">{children(state.result)}</div>
            </>
          ) : null}

          {state.kind === 'ok' ? children(state.result) : null}
        </WidgetErrorBoundary>
      </div>

      <WidgetConfigDisclosure configText={configText} />
    </section>
  )
}

function isBusy<TResult>(state: WidgetState<TResult>) {
  if (state.kind === 'loading') return true
  if (state.kind === 'invalid' || state.kind === 'unresolvable') return true
  return 'isRefreshing' in state && state.isRefreshing
}

function StateBadge<TResult>({ state }: { state: WidgetState<TResult> }) {
  switch (state.kind) {
    case 'invalid':
      return (
        <WidgetBadge icon={FileWarning} tone="danger">
          Invalid configuration
        </WidgetBadge>
      )

    case 'unresolvable':
      return (
        <WidgetBadge icon={Unlink} tone="warning">
          Unresolvable binding
        </WidgetBadge>
      )

    case 'loading':
      return (
        <WidgetBadge icon={RefreshCw} tone="neutral">
          {state.attempt > 1 ? `Retrying (${state.attempt}/${state.maxAttempts})` : 'Loading'}
        </WidgetBadge>
      )

    case 'empty':
      return (
        <WidgetBadge icon={Inbox} tone="neutral">
          No data
        </WidgetBadge>
      )

    case 'error':
      return (
        <WidgetBadge icon={AlertTriangle} tone="danger">
          Cannot load
        </WidgetBadge>
      )

    case 'stale':
      return (
        <WidgetBadge icon={History} tone="warning">
          {`Stale since ${formatClockTime(state.fetchedAt)}`}
        </WidgetBadge>
      )

    case 'ok':
      return state.isRefreshing ? (
        <WidgetBadge icon={RefreshCw} tone="neutral">
          Refreshing
        </WidgetBadge>
      ) : (
        <WidgetBadge icon={Check} tone="neutral" className="sr-only">
          Up to date
        </WidgetBadge>
      )
  }
}
