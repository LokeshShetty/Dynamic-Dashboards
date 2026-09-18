import type { DashboardShell, Widget } from './_lib/config.schema'

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

/** The outcome of the whole load pipeline. Every branch can be rendered without a blank screen. */
export type DashboardLoad =
  | {
      kind: 'loaded'
      shell: DashboardShell
      slots: WidgetSlot[]
      /** The version the configuration was stored as, when a migration ran. */
      migratedFrom: number | null
      rawText: string
    }
  | { kind: 'unsupported-version'; found: number; supported: number; rawText: string }
  | { kind: 'invalid'; error: ConfigError; rawText: string }
