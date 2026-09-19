import { useId } from 'react'

import { SearchableSelect } from '@/components/ui/searchable-select'
import { FORM_CONTROL_CLASS } from '@/constants/ui'
import { cn } from '@/lib/utils'

import { DEFAULT_CURRENCY, NUMBER_STYLES } from '../../../_constants'
import type { NumberFormat } from '../../../_lib/config.schema'
import { CURRENCY_OPTIONS, isKnownCurrency, unknownCurrencyOption } from '../../../_lib/currencies'
import { FormRow } from './form-row'

type Props = {
  value: NumberFormat | undefined
  onChange: (format: NumberFormat | undefined) => void
  error?: string
}

/**
 * Presentation, kept next to the binding it presents.
 *
 * The currency code only appears for the currency style, and it is a list rather than a box: a
 * code is either one Intl knows or a widget that refuses to render, and a reader should not have
 * to find that out by typing three letters. An empty, greyed out box next to the other fields
 * asked a question instead of answering one.
 */
export function NumberFormatFields({ value, onChange, error }: Props) {
  const styleId = useId()
  const decimalsId = useId()
  const currencyId = useId()

  const style = value?.style ?? 'plain'
  const currency = value?.currency ?? ''
  const isMoney = style === 'currency'

  const options =
    currency !== '' && !isKnownCurrency(currency)
      ? [unknownCurrencyOption(currency), ...CURRENCY_OPTIONS]
      : CURRENCY_OPTIONS

  return (
    <div className={cn('grid gap-2', isMoney ? 'grid-cols-3' : 'grid-cols-2')}>
      <FormRow label="Format" controlId={styleId} error={error}>
        <select
          id={styleId}
          className={FORM_CONTROL_CLASS}
          value={style}
          onChange={(event) => {
            const next = NUMBER_STYLES.find((candidate) => candidate === event.target.value)
            if (!next) return

            // Switching to currency with no code is still a currency: it is dollars. Saying so
            // here means the field shows what the tile will do rather than looking unanswered.
            onChange(
              next === 'currency' && currency === ''
                ? { ...value, style: next, currency: DEFAULT_CURRENCY }
                : { ...value, style: next },
            )
          }}
        >
          {NUMBER_STYLES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </FormRow>

      <FormRow label="Decimals" controlId={decimalsId}>
        <input
          id={decimalsId}
          type="number"
          min={0}
          max={4}
          className={FORM_CONTROL_CLASS}
          value={value?.decimals ?? ''}
          onChange={(event) =>
            onChange({
              ...value,
              style,
              ...(event.target.value === ''
                ? { decimals: undefined }
                : { decimals: Number(event.target.value) }),
            })
          }
        />
      </FormRow>

      {isMoney ? (
        <FormRow
          label="Currency"
          controlId={currencyId}
          hint={`Amounts are stored in cents and divided by a hundred to show. Left unset, ${DEFAULT_CURRENCY}.`}
        >
          <SearchableSelect
            id={currencyId}
            label="Currency"
            options={options}
            emptyLabel={`${DEFAULT_CURRENCY} (default)`}
            selection={{
              mode: 'single',
              value: currency === '' ? null : currency,
              onChange: (next) =>
                onChange({
                  ...value,
                  style,
                  ...(next === null ? { currency: undefined } : { currency: next }),
                }),
            }}
          />
        </FormRow>
      ) : null}
    </div>
  )
}
