import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { FIELD_TYPES, type FieldType } from '@/constants/data'
import { CONTROL_CLASS } from '@/constants/ui'
import { DATASET_IDS } from '@/data/_constants'
import { worldFieldNames } from '@/data/_lib/world'
import { useAppStore } from '@/lib/store'

/**
 * Changes to the world rather than to the transport: after any of these, a configuration that
 * was correct when it was saved may no longer resolve, which is the point.
 */
export function ChaosWorldControls() {
  const fieldId = useId()
  const renameField = useAppStore((state) => state.renameField)
  const changeFieldType = useAppStore((state) => state.changeFieldType)
  const dropDataset = useAppStore((state) => state.dropDataset)

  const [dataset, setDataset] = useState<string>(DATASET_IDS[0])
  const [field, setField] = useState<string>(worldFieldNames(DATASET_IDS[0])[0] ?? '')
  const [type, setType] = useState<FieldType>('text')

  const fields = worldFieldNames(dataset)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        <label className="sr-only" htmlFor="chaos-dataset">
          Dataset
        </label>
        <select
          id="chaos-dataset"
          className={CONTROL_CLASS}
          value={dataset}
          onChange={(event) => {
            setDataset(event.target.value)
            setField(worldFieldNames(event.target.value)[0] ?? '')
          }}
        >
          {DATASET_IDS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor={fieldId}>
          Field
        </label>
        <SearchableSelect
          id={fieldId}
          label="field"
          className="min-w-0 flex-1"
          options={fields.map((name) => ({ value: name, label: name }))}
          emptyLabel="Choose a field"
          selection={{
            mode: 'single',
            value: field === '' ? null : field,
            onChange: (next) => setField(next ?? ''),
          }}
        />
      </div>

      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          disabled={field === ''}
          onClick={() => renameField(dataset, field, `${field}_v2`)}
        >
          Rename to {field === '' ? 'field' : `${field}_v2`}
        </Button>

        <label className="sr-only" htmlFor="chaos-type">
          New field type
        </label>
        <select
          id="chaos-type"
          className={CONTROL_CLASS}
          value={type}
          onChange={(event) => {
            const next = FIELD_TYPES.find((candidate) => candidate === event.target.value)
            if (next) setType(next)
          }}
        >
          {FIELD_TYPES.map((candidate) => (
            <option key={candidate} value={candidate}>
              {candidate}
            </option>
          ))}
        </select>

        <Button
          size="sm"
          disabled={field === ''}
          onClick={() => changeFieldType(dataset, field, type)}
        >
          Change type
        </Button>

        <Button size="sm" variant="danger" onClick={() => dropDataset(dataset)}>
          Drop dataset
        </Button>
      </div>
    </div>
  )
}
