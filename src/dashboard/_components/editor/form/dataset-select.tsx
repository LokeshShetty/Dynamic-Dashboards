import { useId } from 'react'

import { FORM_CONTROL_CLASS } from '@/constants/ui'
import { DATASET_IDS } from '@/data/_constants'

import { FormRow } from './form-row'

type Props = {
  value: string
  dashboardDataset: string
  onChange: (dataset: string | undefined) => void
}

/** First choice in the form: everything below it depends on which dataset is being read. */
export function DatasetSelect({ value, dashboardDataset, onChange }: Props) {
  const controlId = useId()

  return (
    <FormRow
      label="Dataset"
      controlId={controlId}
      hint={`The dashboard reads ${dashboardDataset}. A widget may read another dataset.`}
    >
      <select
        id={controlId}
        className={FORM_CONTROL_CLASS}
        value={value}
        onChange={(event) =>
          onChange(event.target.value === dashboardDataset ? undefined : event.target.value)
        }
      >
        {DATASET_IDS.map((dataset) => (
          <option key={dataset} value={dataset}>
            {dataset}
            {dataset === dashboardDataset ? ' (dashboard default)' : ''}
          </option>
        ))}
      </select>
    </FormRow>
  )
}
