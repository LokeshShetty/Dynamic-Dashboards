import { isRecord, isString } from '@/lib/guards'

import { CONFIG_SCHEMA_VERSION } from '../_constants'
import type { ConfigError, DashboardLoad, DroppedFilter, WidgetSlot } from '../_types'
import { summarizeIssues, toConfigIssues } from './config-issues'
import {
  dashboardShellSchema,
  filterSchema,
  widgetSchema,
  type DashboardFilter,
} from './config.schema'
import { guardRawText, guardShape } from './guard'
import { markOverlappingWidgets } from './layout'
import { migrateToCurrent, readSchemaVersion } from './migrate'

/**
 * The one way a configuration becomes a renderable dashboard:
 *
 *   size guard -> JSON.parse -> shape guard -> migrate -> validate the shell ->
 *   validate each widget on its own
 *
 * Every failure carries the exact reason and the original text, so the caller can always
 * show something true rather than a blank screen.
 */
export function loadDashboardConfig(rawText: string): DashboardLoad {
  const invalid = (error: ConfigError): DashboardLoad => ({ kind: 'invalid', error, rawText })

  const guardedText = guardRawText(rawText)
  if (!guardedText.ok) return invalid(guardedText.error)

  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch (error) {
    return invalid({
      code: 'not-json',
      message: error instanceof Error ? error.message : 'the configuration is not valid JSON',
      issues: [],
    })
  }

  const guardedShape = guardShape(parsed)
  if (!guardedShape.ok) return invalid(guardedShape.error)

  const version = readSchemaVersion(guardedShape.data)
  if (!version.ok) return invalid(version.error)

  // A newer format is not guessed at. The caller opens it read only and shows the raw text.
  if (version.data > CONFIG_SCHEMA_VERSION) {
    return {
      kind: 'unsupported-version',
      found: version.data,
      supported: CONFIG_SCHEMA_VERSION,
      rawText,
    }
  }

  const migrated = migrateToCurrent(guardedShape.data)
  if (!migrated.ok) return invalid(migrated.error)

  const shell = dashboardShellSchema.safeParse(migrated.data.value)
  if (!shell.success) {
    return invalid({
      code: 'invalid-dashboard',
      message: 'the dashboard itself is not valid, so none of its widgets can be trusted',
      issues: toConfigIssues(shell.error),
    })
  }

  const filters = toFilters(shell.data.filters)

  return {
    kind: 'loaded',
    shell: shell.data,
    filters: filters.kept,
    droppedFilters: filters.dropped,
    slots: markOverlappingWidgets(toWidgetSlots(shell.data.widgets)),
    migratedFrom: migrated.data.migratedFrom,
    rawText,
  }
}

/**
 * Filters are validated one at a time, like widgets. One that does not validate, or that claims
 * an id another filter already has, is dropped and reported: the filter bar says which one went
 * and why, and every widget keeps rendering under the filters that do work.
 */
export function toFilters(entries: ReadonlyArray<unknown>) {
  const kept: DashboardFilter[] = []
  const dropped: DroppedFilter[] = []
  const takenIds = new Set<string>()

  entries.forEach((entry, index) => {
    const result = filterSchema.safeParse(entry)
    const id = isRecord(entry) && isString(entry.id) ? entry.id : null

    if (!result.success) {
      dropped.push({ index, id, reason: summarizeIssues(toConfigIssues(result.error)) })
      return
    }

    if (takenIds.has(result.data.id)) {
      dropped.push({
        index,
        id: result.data.id,
        reason: `another filter already uses the id "${result.data.id}"`,
      })
      return
    }

    takenIds.add(result.data.id)
    kept.push(result.data)
  })

  return { kept, dropped }
}

/** Reads an id off an unvalidated widget, only so a broken tile can be labelled. */
function readWidgetId(candidate: unknown): string | null {
  if (!isRecord(candidate) || !isString(candidate.id)) return null
  return candidate.id
}

/**
 * Validates widgets one at a time. A widget that fails becomes a slot describing the
 * failure, never a reason to reject the widgets around it. The first widget to claim an id
 * keeps it; later claimants render as a duplicate-id tile rather than being dropped.
 */
export function toWidgetSlots(widgets: ReadonlyArray<unknown>): WidgetSlot[] {
  const firstIndexById = new Map<string, number>()

  return widgets.map((candidate, index) => {
    const result = widgetSchema.safeParse(candidate)

    if (!result.success) {
      return {
        kind: 'invalid',
        index,
        id: readWidgetId(candidate),
        issues: toConfigIssues(result.error),
      }
    }

    const firstIndex = firstIndexById.get(result.data.id)
    if (firstIndex !== undefined) {
      return { kind: 'duplicate-id', index, id: result.data.id, firstIndex }
    }

    firstIndexById.set(result.data.id, index)
    return { kind: 'valid', index, id: result.data.id, widget: result.data }
  })
}
