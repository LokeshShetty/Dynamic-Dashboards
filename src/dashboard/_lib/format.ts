import { isMoneyUnit } from '@/constants/data'
import type { ResolvedField } from '@/data/_types'
import { err, ok, type Result } from '@/lib/result'
import type { DataValue } from '@/types/data'

import type { NumberFormat } from './config.schema'

/**
 * Formatting is a claim about what a number means, so it is resolved against the field rather
 * than applied hopefully. Money is stored in cents here, and a currency format is only
 * meaningful over a field that says it holds money.
 */
export type ValueFormatter = (value: DataValue) => string

const CENTS_IN_A_UNIT = 100

export function resolveFormatter(
  field: ResolvedField,
  format: NumberFormat | undefined,
): Result<ValueFormatter, string> {
  if (!format) return ok((value) => formatByType(value, field))

  if (format.style === 'currency') {
    if (!isMoneyUnit(field.unit)) {
      return err(
        `currency formatting needs a field that holds money, and "${field.name}" carries no money unit`,
      )
    }

    const currency = format.currency ?? 'USD'
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: format.decimals ?? 2,
      maximumFractionDigits: format.decimals ?? 2,
    })

    return ok((value) =>
      typeof value === 'number'
        ? formatter.format(value / CENTS_IN_A_UNIT)
        : formatByType(value, field),
    )
  }

  const formatter = new Intl.NumberFormat(undefined, {
    notation: format.style === 'compact' ? 'compact' : 'standard',
    style: format.style === 'percent' ? 'percent' : 'decimal',
    minimumFractionDigits: format.decimals,
    maximumFractionDigits: format.decimals ?? (format.style === 'compact' ? 1 : 2),
  })

  return ok((value) =>
    typeof value === 'number' ? formatter.format(value) : formatByType(value, field),
  )
}

/** What a value looks like when the configuration says nothing about presentation. */
export function formatByType(value: DataValue, field: ResolvedField): string {
  if (value === null) return '—'

  if (field.type === 'date') return formatDate(String(value))

  if (typeof value === 'number') {
    const decimals = Number.isInteger(value) ? 0 : 2
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value)
  }

  if (typeof value === 'boolean') return value ? 'yes' : 'no'

  return String(value)
}

export function formatDate(iso: string): string {
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return iso
  return new Date(time).toISOString().slice(0, 10)
}

/** Times are shown to the second, because staleness is measured in seconds here. */
export function formatClockTime(epochMs: number): string {
  if (!Number.isFinite(epochMs) || epochMs <= 0) return 'an unknown time'
  return new Date(epochMs).toLocaleTimeString(undefined, { hour12: false })
}

export function formatFieldUnit(field: ResolvedField): string {
  return field.unit === null ? field.type : `${field.type} · ${field.unit}`
}
