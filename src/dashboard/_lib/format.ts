import { isMoneyUnit } from '@/constants/data'
import type { ResolvedField } from '@/data/_types'
import { err, ok, type Result } from '@/lib/result'
import type { DataValue } from '@/types/data'

import { DEFAULT_CURRENCY } from '../_constants'
import type { NumberFormat } from './config.schema'

/**
 * Formatting is a claim about what a number means, so it is resolved against the field rather
 * than applied hopefully. Money is stored in cents here, and a currency format is only
 * meaningful over a field that says it holds money.
 */
export type ValueFormatter = (value: DataValue) => string

const CENTS_IN_A_UNIT = 100

/**
 * Axis ticks get the compact variant: $100,000 does not fit in an axis gutter, and widening the
 * gutter to fit it takes the space away from the chart. The full value stays in the tooltip.
 */
export type FormatVariant = 'full' | 'compact'

export function resolveFormatter(
  field: ResolvedField,
  format: NumberFormat | undefined,
  variant: FormatVariant = 'full',
): Result<ValueFormatter, string> {
  if (!format) {
    return ok((value) =>
      variant === 'compact' && typeof value === 'number'
        ? compactNumber(value)
        : formatByType(value, field),
    )
  }

  if (format.style === 'currency') {
    if (!isMoneyUnit(field.unit)) {
      return err(
        `currency formatting needs a field that holds money, and "${field.name}" carries no money unit`,
      )
    }

    const currency = format.currency ?? DEFAULT_CURRENCY

    // The schema can only check that a currency code is three characters. Intl decides whether
    // it is a currency, and says so by throwing, which must not escape a function whose whole
    // contract is to hand back a reason instead.
    let formatter: Intl.NumberFormat
    try {
      formatter = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        notation: variant === 'compact' ? 'compact' : 'standard',
        minimumFractionDigits: variant === 'compact' ? 0 : (format.decimals ?? 2),
        maximumFractionDigits: variant === 'compact' ? 1 : (format.decimals ?? 2),
      })
    } catch {
      return err(`"${currency}" is not a currency code this browser knows`)
    }

    return ok((value) =>
      typeof value === 'number'
        ? formatter.format(value / CENTS_IN_A_UNIT)
        : formatByType(value, field),
    )
  }

  // Percent multiplies by a hundred, which is a claim about the number, not a way of writing it.
  if (format.style === 'percent' && field.unit !== 'percent') {
    return err(
      `percent formatting multiplies by a hundred, and "${field.name}" does not hold a percentage`,
    )
  }

  const isCompact = format.style === 'compact' || variant === 'compact'

  let formatter: Intl.NumberFormat
  try {
    formatter = new Intl.NumberFormat(undefined, {
      notation: isCompact ? 'compact' : 'standard',
      style: format.style === 'percent' ? 'percent' : 'decimal',
      minimumFractionDigits: isCompact ? 0 : format.decimals,
      maximumFractionDigits: isCompact ? 1 : (format.decimals ?? 2),
    })
  } catch {
    return err('this browser refused that number format')
  }

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

function compactNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  )
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
