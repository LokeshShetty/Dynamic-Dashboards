import type { SelectOption } from '@/types/ui'

import { FALLBACK_CURRENCY_CODES } from '../_constants'

/**
 * The currency codes this browser can name, with their names, because "BHD" is a guess and
 * "BHD · Bahraini Dinar" is a choice. The list is read from Intl rather than written down, so it
 * is the same list the formatter will accept: a code picked here cannot be a code that makes the
 * tile refuse to render.
 */
export const CURRENCY_OPTIONS: SelectOption[] = buildCurrencyOptions()

/** An option for a code that is not in the list, so a saved config is shown rather than dropped. */
export function unknownCurrencyOption(code: string): SelectOption {
  return { value: code, label: code, hint: 'not a code this browser knows', isMissing: true }
}

export function isKnownCurrency(code: string): boolean {
  return CURRENCY_OPTIONS.some((option) => option.value === code)
}

function buildCurrencyOptions(): SelectOption[] {
  const codes = supportedCurrencies()
  const names = currencyNames()

  return codes.map((code) => {
    const name = names?.(code)
    return name === undefined || name === code
      ? { value: code, label: code }
      : { value: code, label: code, hint: name }
  })
}

function supportedCurrencies(): string[] {
  try {
    return [...Intl.supportedValuesOf('currency')]
  } catch {
    return [...FALLBACK_CURRENCY_CODES]
  }
}

function currencyNames(): ((code: string) => string | undefined) | null {
  try {
    const display = new Intl.DisplayNames(undefined, { type: 'currency' })
    return (code) => display.of(code)
  } catch {
    return null
  }
}
