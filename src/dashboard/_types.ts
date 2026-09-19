import type { DataResult } from '@/data/_types'

import type { DashboardFilter, DashboardShell, Widget } from './_lib/config.schema'
import type { FilterValues } from './_lib/to-data-query'

/** One validation problem, with the path it was found at, ready to show to a user. */
export type ConfigIssue = { path: string; message: string }

export type ConfigErrorCode =
  | 'too-large'
  | 'not-json'
  | 'not-an-object'
  | 'too-deep'
  | 'forbidden-key'
  | 'too-many-widgets'
  | 'missing-schema-version'
  | 'schema-version-too-old'
  | 'migration-failed'
  | 'invalid-dashboard'

export type ConfigError = {
  code: ConfigErrorCode
  message: string
  issues: ConfigIssue[]
}

/**
 * The outcome of validating one entry in the widgets array. A slot is always renderable:
 * either as the widget it describes, or as a tile that says why it cannot be rendered.
 */
export type WidgetSlot =
  | { kind: 'valid'; index: number; id: string; widget: Widget }
  | { kind: 'invalid'; index: number; id: string | null; issues: ConfigIssue[] }
  | { kind: 'duplicate-id'; index: number; id: string; firstIndex: number }
  | { kind: 'overlapping-layout'; index: number; id: string; overlapsId: string }

/**
 * A filter definition that did not validate. It is dropped rather than fatal: a filter the
 * reader can see and change should not cost them the entire dashboard.
 */
export type DroppedFilter = { index: number; id: string | null; reason: string }

/** The outcome of the whole load pipeline. Every branch can be rendered without a blank screen. */
export type DashboardLoad =
  | {
      kind: 'loaded'
      shell: DashboardShell
      /** The filters that validated, in configuration order. */
      filters: DashboardFilter[]
      droppedFilters: DroppedFilter[]
      slots: WidgetSlot[]
      /** The version the configuration was stored as, when a migration ran. */
      migratedFrom: number | null
      rawText: string
    }
  | { kind: 'unsupported-version'; found: number; supported: number; rawText: string }
  | { kind: 'invalid'; error: ConfigError; rawText: string }

/**
 * Everything a widget can be, as one union. The frame renders these and nothing else renders
 * them, so a widget cannot invent a state of its own, and none of these can be mistaken for
 * another: stale carries the data and the failure together, so old numbers are never
 * presented as live ones.
 */
export type WidgetState<TResult = DataResult> =
  | { kind: 'invalid'; reason: string; issues: ConfigIssue[] }
  | { kind: 'unresolvable'; reason: string }
  | { kind: 'loading'; attempt: number; maxAttempts: number }
  | { kind: 'empty'; reason: string; fetchedAt: number; isRefreshing: boolean }
  | { kind: 'ok'; result: TResult; fetchedAt: number; isRefreshing: boolean }
  | {
      kind: 'stale'
      result: TResult
      fetchedAt: number
      failedAt: number
      reason: string
      attempt: number
      maxAttempts: number
      isRefreshing: boolean
    }
  | {
      kind: 'error'
      reason: string
      attempt: number
      maxAttempts: number
      isRefreshing: boolean
    }

/**
 * What a widget needs to know about the filter bar above it. The definitions and the values are
 * passed rather than the finished predicates, because a widget may opt out of a filter with
 * `ignoredFilterIds`, and only the widget knows which.
 */
export type WidgetFilterContext = {
  definitions: DashboardFilter[]
  values: FilterValues
  /** Field name to the label the reader sees, so a skipped filter can be named on the tile. */
  labels: Record<string, string>
}

/** Where one tile sits on the grid, and how small it is allowed to get. */
export type GridPlacement = {
  key: string
  x: number
  y: number
  w: number
  h: number
  minW: number
  minH: number
  maxW: number
  maxH: number
}

/** One line or set of bars on a chart, named for the legend. */
export type ChartSeries = { key: string; label: string }

/**
 * Why the editor cannot save right now. Saving is compare and swap against the stored version,
 * so without that version there is nothing to compare, and the reason belongs on the screen
 * rather than in a disabled button.
 */
export type SaveBlocker =
  { kind: 'waiting'; message: string } | { kind: 'blocked'; message: string }
