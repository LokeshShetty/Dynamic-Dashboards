import { useId } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { useFieldArray } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { FORM_CONTROL_CLASS } from '@/constants/ui'

import { CONFIG_LIMITS, SORT_DIRECTIONS } from '../../../_constants'
import { useDatasetSchema } from '../../../_hooks/use-dataset-schema'
import { useLiveWidgetForm } from '../../../_hooks/use-live-widget-form'
import { tableWidgetSchema, type TableWidget } from '../../../_lib/config.schema'
import { readTableDefaults } from '../../../_lib/widget-form'
import { DatasetSelect } from './dataset-select'
import { FieldSelect } from './field-select'
import { FormRow } from './form-row'
import { NumberFormatFields } from './number-format-fields'

type Props = {
  entry: unknown
  dashboardDataset: string
  onChange: (values: unknown) => void
  formId: string
  onSubmit: () => void
}

export function TableForm({ entry, dashboardDataset, onChange, formId, onSubmit }: Props) {
  const titleId = useId()
  const pageSizeId = useId()
  const directionId = useId()

  const form = useLiveWidgetForm<TableWidget>(
    {
      resolver: zodResolver(tableWidgetSchema),
      defaultValues: readTableDefaults(entry),
      mode: 'onChange',
    },
    onChange,
  )

  const columns = useFieldArray({ control: form.control, name: 'columns' })
  const values = form.watch()
  const dataset = values.dataset ?? dashboardDataset
  const schema = useDatasetSchema(dataset)
  const errors = form.formState.errors

  return (
    <form id={formId} className="flex flex-col gap-3" onSubmit={form.handleSubmit(onSubmit)}>
      <DatasetSelect
        value={dataset}
        dashboardDataset={dashboardDataset}
        onChange={(next) => form.setValue('dataset', next, { shouldValidate: true })}
      />

      <FormRow label="Title" controlId={titleId} error={errors.title?.message}>
        <input id={titleId} className={FORM_CONTROL_CLASS} {...form.register('title')} />
      </FormRow>

      <fieldset className="border-border flex flex-col gap-3 rounded-md border p-2">
        <legend className="text-fg-muted px-1 text-xs font-medium">Columns</legend>

        {columns.fields.map((column, index) => (
          <div
            key={column.id}
            className="border-border flex flex-col gap-2 border-b pb-2 last:border-0"
          >
            <div className="flex items-end gap-2">
              <FieldSelect
                label={`Column ${index + 1}`}
                value={values.columns?.[index]?.field ?? ''}
                schema={schema}
                error={errors.columns?.[index]?.field?.message}
                onChange={(field) =>
                  form.setValue(`columns.${index}.field`, field, { shouldValidate: true })
                }
              />
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Remove column ${index + 1}`}
                disabled={columns.fields.length === 1}
                onClick={() => columns.remove(index)}
              >
                <Trash2 aria-hidden="true" className="text-danger size-3" />
              </Button>
            </div>

            <input
              className={FORM_CONTROL_CLASS}
              placeholder="Column heading"
              aria-label={`Column ${index + 1} heading`}
              {...form.register(`columns.${index}.label`)}
            />

            <NumberFormatFields
              value={values.columns?.[index]?.format}
              onChange={(format) =>
                form.setValue(`columns.${index}.format`, format, { shouldValidate: true })
              }
            />
          </div>
        ))}

        <Button
          size="sm"
          disabled={columns.fields.length >= CONFIG_LIMITS.MAX_TABLE_COLUMNS}
          onClick={() => columns.append({ field: '' })}
        >
          <Plus aria-hidden="true" className="size-3" />
          Add column
        </Button>
      </fieldset>

      <div className="grid grid-cols-3 gap-2">
        <FormRow label="Rows per page" controlId={pageSizeId} error={errors.pageSize?.message}>
          <input
            id={pageSizeId}
            type="number"
            min={1}
            max={CONFIG_LIMITS.MAX_PAGE_SIZE}
            className={FORM_CONTROL_CLASS}
            {...form.register('pageSize', { valueAsNumber: true })}
          />
        </FormRow>

        <FieldSelect
          label="Sort by"
          value={values.sort?.field ?? ''}
          schema={schema}
          optional
          error={errors.sort?.field?.message}
          onChange={(field) =>
            form.setValue(
              'sort',
              field === '' ? undefined : { field, direction: values.sort?.direction ?? 'desc' },
              { shouldValidate: true },
            )
          }
        />

        <FormRow label="Direction" controlId={directionId}>
          <select
            id={directionId}
            className={FORM_CONTROL_CLASS}
            disabled={values.sort === undefined}
            value={values.sort?.direction ?? 'desc'}
            onChange={(event) => {
              const direction = SORT_DIRECTIONS.find(
                (candidate) => candidate === event.target.value,
              )
              if (direction && values.sort) {
                form.setValue('sort', { ...values.sort, direction }, { shouldValidate: true })
              }
            }}
          >
            {SORT_DIRECTIONS.map((direction) => (
              <option key={direction} value={direction}>
                {direction}
              </option>
            ))}
          </select>
        </FormRow>
      </div>
    </form>
  )
}
