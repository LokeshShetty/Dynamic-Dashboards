import { useId } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'

import { FORM_CONTROL_CLASS } from '@/constants/ui'

import { useDatasetSchema } from '../../../_hooks/use-dataset-schema'
import { useLiveWidgetForm } from '../../../_hooks/use-live-widget-form'
import { metricWidgetSchema, type MetricWidget } from '../../../_lib/config.schema'
import { fieldTypeOf, readMetricDefaults } from '../../../_lib/widget-form'
import { AggregateSelect } from './aggregate-select'
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

export function MetricForm({ entry, dashboardDataset, onChange, formId, onSubmit }: Props) {
  const titleId = useId()
  const form = useLiveWidgetForm<MetricWidget>(
    {
      resolver: zodResolver(metricWidgetSchema),
      defaultValues: readMetricDefaults(entry),
      mode: 'onChange',
    },
    onChange,
  )

  const values = form.watch()
  const dataset = values.dataset ?? dashboardDataset
  const schema = useDatasetSchema(dataset)
  const fields = schema.kind === 'ok' ? schema.fields : []
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

      <FieldSelect
        label="Field"
        value={values.value?.field ?? ''}
        schema={schema}
        error={errors.value?.field?.message}
        onChange={(field) => form.setValue('value.field', field, { shouldValidate: true })}
      />

      <AggregateSelect
        label="Aggregate"
        value={values.value?.aggregate ?? 'count'}
        fieldType={fieldTypeOf(fields, values.value?.field ?? '')}
        error={errors.value?.aggregate?.message}
        onChange={(aggregate) =>
          form.setValue('value.aggregate', aggregate, { shouldValidate: true })
        }
      />

      <NumberFormatFields
        value={values.format}
        error={errors.format?.message}
        onChange={(format) => form.setValue('format', format, { shouldValidate: true })}
      />
    </form>
  )
}
