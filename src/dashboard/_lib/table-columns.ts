import type { ResolvedColumn, ResolvedField } from '@/data/_types'

import type { TableWidget } from './config.schema'
import { formatFieldUnit, resolveFormatter, type ValueFormatter } from './format'

/**
 * Columns are resolved one at a time. A table whose amount column was renamed still shows the
 * claim ids, the dates and the payers: losing one column is a reason to mark that column, not
 * a reason to deny the reader the other nine.
 */
export type ColumnView =
  | {
      kind: 'ok'
      name: string
      label: string
      field: ResolvedField
      typeLabel: string
      align: 'left' | 'right'
      format: ValueFormatter
    }
  | { kind: 'unresolved'; name: string; label: string; reason: string }

export function toColumnViews(
  configured: TableWidget['columns'],
  resolved: ReadonlyArray<ResolvedColumn>,
): ColumnView[] {
  return configured.map((column, index) => {
    const label = column.label ?? column.field
    const match = resolved[index]

    if (!match || match.kind === 'unresolved') {
      return {
        kind: 'unresolved',
        name: column.field,
        label,
        reason: `field "${column.field}" is not in the dataset any more`,
      }
    }

    const formatter = resolveFormatter(match.field, column.format)

    if (!formatter.ok) {
      return { kind: 'unresolved', name: column.field, label, reason: formatter.error }
    }

    return {
      kind: 'ok',
      name: match.field.name,
      label,
      field: match.field,
      typeLabel: formatFieldUnit(match.field),
      align: column.align ?? (match.field.type === 'number' ? 'right' : 'left'),
      format: formatter.data,
    }
  })
}
