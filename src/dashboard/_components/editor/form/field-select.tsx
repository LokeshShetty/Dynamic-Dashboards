import { useId } from 'react'

import type { DatasetSchemaState } from '../../../_hooks/use-dataset-schema'
import { FORM_CONTROL_CLASS, FormRow } from './form-row'

type Props = {
  label: string
  value: string
  schema: DatasetSchemaState
  error?: string
  onChange: (field: string) => void
  optional?: boolean
}

/**
 * Picks a field out of the dataset as it is right now. A widget bound to a field that has since
 * been removed keeps its value, marked, so opening the editor on a broken widget shows what it
 * was asking for instead of quietly clearing it. If the schema cannot be fetched at all, the
 * name can still be typed.
 */
export function FieldSelect({ label, value, schema, error, onChange, optional = false }: Props) {
  const controlId = useId()

  if (schema.kind === 'loading') {
    return (
      <FormRow label={label} controlId={controlId} error={error}>
        <div className="bg-surface-muted h-8 w-full animate-pulse rounded-md" />
      </FormRow>
    )
  }

  if (schema.kind === 'error') {
    return (
      <FormRow
        label={label}
        controlId={controlId}
        error={error}
        hint={`Cannot list fields: ${schema.reason}. Type the field name instead.`}
      >
        <input
          id={controlId}
          className={FORM_CONTROL_CLASS}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </FormRow>
    )
  }

  const names = schema.fields.map((field) => field.name)
  const isMissing = value !== '' && !names.includes(value)

  return (
    <FormRow
      label={label}
      controlId={controlId}
      error={error}
      hint={isMissing ? `“${value}” is not in this dataset any more` : undefined}
    >
      <select
        id={controlId}
        className={FORM_CONTROL_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{optional ? 'None' : 'Choose a field'}</option>
        {isMissing ? <option value={value}>{value} (not in dataset)</option> : null}
        {schema.fields.map((field) => (
          <option key={field.name} value={field.name}>
            {field.name} ({field.type})
          </option>
        ))}
      </select>
    </FormRow>
  )
}
