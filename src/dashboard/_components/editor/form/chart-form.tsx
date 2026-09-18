import { useId } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { useFieldArray } from 'react-hook-form'

import { Button } from '@/components/ui/button'

import { CHART_TYPES, CONFIG_LIMITS, TIME_BUCKETS } from '../../../_constants'
import { useDatasetSchema } from '../../../_hooks/use-dataset-schema'
import { useLiveWidgetForm } from '../../../_hooks/use-live-widget-form'
import { chartWidgetSchema, type ChartWidget } from '../../../_lib/config.schema'
import { fieldTypeOf, readChartDefaults } from '../../../_lib/widget-form'
import { AggregateSelect } from './aggregate-select'
import { DatasetSelect } from './dataset-select'
import { FieldSelect } from './field-select'
import { FORM_CONTROL_CLASS, FormRow } from './form-row'

type Props = {
  entry: unknown
  dashboardDataset: string
  onChange: (values: unknown) => void
  formId: string
  onSubmit: () => void
}

export function ChartForm({ entry, dashboardDataset, onChange, formId, onSubmit }: Props) {
  const titleId = useId()
  const typeId = useId()
  const bucketId = useId()
  const stackedId = useId()

  const form = useLiveWidgetForm<ChartWidget>(
    {
      resolver: zodResolver(chartWidgetSchema),
      defaultValues: readChartDefaults(entry),
      mode: 'onChange',
    },
    onChange,
  )

  const series = useFieldArray({ control: form.control, name: 'series' })
  const values = form.watch()
  const dataset = values.dataset ?? dashboardDataset
  const schema = useDatasetSchema(dataset)
  const fields = schema.kind === 'ok' ? schema.fields : []
  const errors = form.formState.errors
  const isGrouped = values.groupBy !== undefined && values.groupBy.field !== ''

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

      <div className="grid grid-cols-2 gap-2">
        <FormRow label="Chart type" controlId={typeId} error={errors.chartType?.message}>
          <select id={typeId} className={FORM_CONTROL_CLASS} {...form.register('chartType')}>
            {CHART_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </FormRow>

        <FormRow label="Bucket dates by" controlId={bucketId}>
          <select
            id={bucketId}
            className={FORM_CONTROL_CLASS}
            value={values.x?.bucket ?? ''}
            onChange={(event) => {
              const bucket = TIME_BUCKETS.find((candidate) => candidate === event.target.value)
              form.setValue('x.bucket', bucket, { shouldValidate: true })
            }}
          >
            <option value="">No bucketing</option>
            {TIME_BUCKETS.map((bucket) => (
              <option key={bucket} value={bucket}>
                {bucket}
              </option>
            ))}
          </select>
        </FormRow>
      </div>

      <FieldSelect
        label="Axis field"
        value={values.x?.field ?? ''}
        schema={schema}
        error={errors.x?.field?.message}
        onChange={(field) => form.setValue('x.field', field, { shouldValidate: true })}
      />

      <FieldSelect
        label="Group by"
        value={values.groupBy?.field ?? ''}
        schema={schema}
        optional
        error={errors.groupBy?.field?.message}
        onChange={(field) =>
          form.setValue('groupBy', field === '' ? undefined : { field }, { shouldValidate: true })
        }
      />

      <fieldset className="border-border flex flex-col gap-3 rounded-md border p-2">
        <legend className="text-fg-muted px-1 text-xs font-medium">
          {isGrouped ? 'Value (one series, split by the group)' : 'Series'}
        </legend>

        {series.fields.map((entrySeries, index) => (
          <div
            key={entrySeries.id}
            className="border-border flex flex-col gap-2 border-b pb-2 last:border-0"
          >
            <div className="flex items-end gap-2">
              <FieldSelect
                label={`Series ${index + 1} field`}
                value={values.series?.[index]?.field ?? ''}
                schema={schema}
                error={errors.series?.[index]?.field?.message}
                onChange={(field) =>
                  form.setValue(`series.${index}.field`, field, { shouldValidate: true })
                }
              />
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Remove series ${index + 1}`}
                disabled={series.fields.length === 1}
                onClick={() => series.remove(index)}
              >
                <Trash2 aria-hidden="true" className="text-danger size-3" />
              </Button>
            </div>

            <AggregateSelect
              label="Aggregate"
              value={values.series?.[index]?.aggregate ?? 'count'}
              fieldType={fieldTypeOf(fields, values.series?.[index]?.field ?? '')}
              error={errors.series?.[index]?.aggregate?.message}
              onChange={(aggregate) =>
                form.setValue(`series.${index}.aggregate`, aggregate, { shouldValidate: true })
              }
            />

            <input
              className={FORM_CONTROL_CLASS}
              placeholder="Series label"
              aria-label={`Series ${index + 1} label`}
              {...form.register(`series.${index}.label`)}
            />
          </div>
        ))}

        <Button
          size="sm"
          disabled={isGrouped || series.fields.length >= CONFIG_LIMITS.MAX_CHART_SERIES}
          title={isGrouped ? 'A grouped chart carries exactly one series' : undefined}
          onClick={() => series.append({ field: '', aggregate: 'count' })}
        >
          <Plus aria-hidden="true" className="size-3" />
          Add series
        </Button>

        {errors.series?.message === undefined ? null : (
          <p role="alert" className="text-danger text-xs">
            {errors.series.message}
          </p>
        )}
      </fieldset>

      <div className="flex items-center gap-2">
        <input id={stackedId} type="checkbox" {...form.register('stacked')} />
        <label htmlFor={stackedId} className="text-fg-muted text-xs">
          Stack the series
        </label>
      </div>
    </form>
  )
}
