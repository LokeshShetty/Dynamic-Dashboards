import { useState, type ReactNode } from 'react'

import {
  AlertTriangle,
  Check,
  FileWarning,
  FilterX,
  History,
  Inbox,
  Info,
  RefreshCw,
  Unlink,
} from 'lucide-react'

import { BidiText } from '@/components/ui/bidi-text'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { UnappliedFilter } from '../_lib/filter-notices'
import { formatClockTime } from '../_lib/format'
import type { WidgetState } from '../_types'
import { WidgetBadge } from './widget-badge'
import { WidgetConfigDisclosure } from './widget-config-disclosure'
import { WidgetErrorBoundary } from './widget-error-boundary'
import { WidgetStateNotice } from './widget-state-notice'
import { WidgetStatePanel } from './widget-state-panel'

/** A stable empty list, so the default does not make every frame re-render. */
const NO_UNAPPLIED_FILTERS: UnappliedFilter[] = []

type Props<TResult> = {
  title: string
  widgetId: string
  state: WidgetState<TResult>
  skeleton: ReactNode
  configText: string
  onRefresh: () => void
  /** Filters the data layer could not honour, so the tile can say it is showing unfiltered data. */
  unappliedFilters?: UnappliedFilter[]
  children: (result: TResult) => ReactNode
  className?: string
}

/**
 * The only component that renders widget states. A widget body is handed data or it is not
 * rendered at all, which is what keeps the promise enforceable: there is exactly one place
 * where "showing the truth" and "visibly showing that it cannot" are decided.
 *
 * A state that cannot show data takes over the tile and is composed for it, centred, with the
 * reason and the configuration that caused it. These states are the product, not an accident.
 */
export function WidgetFrame<TResult>({
  title,
  widgetId,
  state,
  skeleton,
  configText,
  onRefresh,
  unappliedFilters = NO_UNAPPLIED_FILTERS,
  children,
  className,
}: Props<TResult>) {
  const isTakenOver = takesOverTile(state)

  // On a tile that is showing data, the configuration is one click away rather than a row of
  // chrome under every widget. A tile that cannot show data keeps it inside its own panel.
  const [showsConfig, setShowsConfig] = useState(false)

  return (
    <section
      aria-label={title}
      className={cn(
        'border-border bg-surface-raised flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden rounded-lg border p-3',
        className,
      )}
    >
      <header className="flex shrink-0 items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-fg truncate text-sm font-semibold">
            <BidiText>{title}</BidiText>
          </h3>
          <span className="flex flex-wrap items-center gap-1">
            {isTakenOver ? null : <HeaderBadge state={state} />}
            {unappliedFilters.length > 0 ? (
              <WidgetBadge icon={FilterX} tone="warning">
                {unappliedFilters.length === 1
                  ? `Unfiltered: ${unappliedFilters[0]?.label ?? ''}`
                  : `${unappliedFilters.length} filters not applied`}
              </WidgetBadge>
            ) : null}
          </span>
        </div>
        <span className="flex shrink-0 items-center">
          {isTakenOver ? null : (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`${showsConfig ? 'Hide' : 'Show'} the configuration for ${title}`}
              aria-pressed={showsConfig}
              onClick={() => setShowsConfig((shown: boolean) => !shown)}
            >
              <Info aria-hidden="true" className="size-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            aria-label={`Refresh ${title}`}
            onClick={onRefresh}
            disabled={isBusy(state)}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
          </Button>
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
        {showsConfig && !isTakenOver ? (
          <pre className="border-border bg-surface-muted text-fg-muted min-h-0 flex-1 overflow-auto rounded-md border p-2 text-xs">
            {configText}
          </pre>
        ) : null}

        <WidgetErrorBoundary widgetId={widgetId} onRetry={onRefresh}>
          {state.kind === 'invalid' ? (
            <WidgetStatePanel
              tone="danger"
              icon={FileWarning}
              label="Invalid configuration"
              message={state.reason}
              issues={state.issues}
            >
              <WidgetConfigDisclosure configText={configText} className="w-full max-w-prose" />
            </WidgetStatePanel>
          ) : null}

          {state.kind === 'unresolvable' ? (
            <WidgetStatePanel
              tone="warning"
              icon={Unlink}
              label="Unresolvable binding"
              message={state.reason}
              retry={{ label: 'Check again', onRetry: onRefresh }}
            >
              <WidgetConfigDisclosure configText={configText} className="w-full max-w-prose" />
            </WidgetStatePanel>
          ) : null}

          {state.kind === 'error' ? (
            <WidgetStatePanel
              tone="danger"
              icon={AlertTriangle}
              label={
                state.isRefreshing
                  ? `Retrying (${state.attempt}/${state.maxAttempts})`
                  : 'Cannot load'
              }
              message={state.reason}
              retry={{ label: 'Retry now', onRetry: onRefresh }}
            />
          ) : null}

          {state.kind === 'empty' ? (
            <WidgetStatePanel
              tone="neutral"
              icon={Inbox}
              label="No data"
              message="No rows match the filters in force, so there is nothing to show here."
              retry={{ label: 'Check again', onRetry: onRefresh }}
            />
          ) : null}

          {unappliedFilters.length > 0 && !isTakenOver ? (
            <WidgetStateNotice
              tone="warning"
              message={`${unappliedFilters.map((entry) => entry.reason).join('. ')}. This widget is showing unfiltered data.`}
            />
          ) : null}

          {state.kind === 'loading' && !showsConfig ? skeleton : null}

          {state.kind === 'stale' && !showsConfig ? (
            <>
              <WidgetStateNotice
                tone="warning"
                message={
                  state.isRefreshing
                    ? `Stale since ${formatClockTime(state.fetchedAt)}, retrying (${state.attempt}/${state.maxAttempts})`
                    : `Stale since ${formatClockTime(state.fetchedAt)}, refresh failed: ${state.reason}`
                }
                retry={{ label: 'Retry now', onRetry: onRefresh }}
              />
              <div className="pointer-events-none opacity-50">{children(state.result)}</div>
            </>
          ) : null}

          {state.kind === 'ok' && !showsConfig ? children(state.result) : null}
        </WidgetErrorBoundary>
      </div>
    </section>
  )
}

/** States with no data to show own the whole tile, including where the configuration lives. */
function takesOverTile<TResult>(state: WidgetState<TResult>) {
  return (
    state.kind === 'invalid' ||
    state.kind === 'unresolvable' ||
    state.kind === 'error' ||
    state.kind === 'empty'
  )
}

function isBusy<TResult>(state: WidgetState<TResult>) {
  if (state.kind === 'loading') return true
  if (state.kind === 'invalid') return true
  return 'isRefreshing' in state && state.isRefreshing
}

function HeaderBadge<TResult>({ state }: { state: WidgetState<TResult> }) {
  switch (state.kind) {
    case 'loading':
      return (
        <WidgetBadge icon={RefreshCw} tone="neutral">
          {state.attempt > 1 ? `Retrying (${state.attempt}/${state.maxAttempts})` : 'Loading'}
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

    default:
      return null
  }
}
