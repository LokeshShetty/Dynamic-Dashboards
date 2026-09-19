import { useId } from 'react'

import { FORM_CONTROL_CLASS } from '@/constants/ui'

import { NUMBER_STYLES } from '../../../_constants'
import type { NumberFormat } from '../../../_lib/config.schema'
import { FormRow } from './form-row'

type Props = {
  value: NumberFormat | undefined
  onChange: (format: NumberFormat | undefined) => void
  error?: string
}

/** Presentation, kept next to the binding it presents. */
export function NumberFormatFields({ value, onChange, error }: Props) {
  const styleId = useId()
  const decimalsId = useId()
  const currencyId = useId()

  const style = value?.style ?? 'plain'

  return (
    <div className="grid grid-cols-3 gap-2">
      <FormRow label="Format" controlId={styleId} error={error}>
        <select
          id={styleId}
          className={FORM_CONTROL_CLASS}
          value={style}
          onChange={(event) => {
            const next = NUMBER_STYLES.find((candidate) => candidate === event.target.value)
            if (next) onChange({ ...value, style: next })
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

      <FormRow
        label="Currency"
        controlId={currencyId}
        hint={style === 'currency' ? 'e.g. USD' : ''}
      >
        <input
          id={currencyId}
          className={FORM_CONTROL_CLASS}
          maxLength={3}
          disabled={style !== 'currency'}
          value={value?.currency ?? ''}
          onChange={(event) =>
            onChange({ ...value, style, currency: event.target.value.toUpperCase() })
          }
        />
      </FormRow>
    </div>
  )
}
