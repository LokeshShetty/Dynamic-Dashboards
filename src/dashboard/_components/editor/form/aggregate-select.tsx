import { useId } from 'react'

import type { Aggregate, FieldType } from '@/constants/data'
import { FORM_CONTROL_CLASS } from '@/constants/ui'

import { aggregatesFor } from '../../../_lib/widget-form'
import { FormRow } from './form-row'

type Props = {
  label: string
  value: Aggregate
  fieldType: FieldType | null
  error?: string
  onChange: (aggregate: Aggregate) => void
}

/** Only the aggregates that mean something over the chosen field are offered. */
export function AggregateSelect({ label, value, fieldType, error, onChange }: Props) {
  const controlId = useId()
  const options = aggregatesFor(fieldType)
  const isUnavailable = !options.includes(value)

  return (
    <FormRow
      label={label}
      controlId={controlId}
      error={error}
      hint={
        isUnavailable && fieldType !== null
          ? `${value} does not work over a ${fieldType} field`
          : undefined
      }
    >
      <select
        id={controlId}
        className={FORM_CONTROL_CLASS}
        value={value}
        onChange={(event) => {
          const next = options.find((candidate) => candidate === event.target.value)
          if (next) onChange(next)
        }}
      >
        {isUnavailable ? <option value={value}>{value} (not available here)</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FormRow>
  )
}
