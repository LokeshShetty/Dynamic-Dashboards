import { useId } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'

import { FORM_CONTROL_CLASS } from '@/constants/ui'

import { TEXT_TONES } from '../../../_constants'
import { useLiveWidgetForm } from '../../../_hooks/use-live-widget-form'
import { textWidgetSchema, type TextWidget } from '../../../_lib/config.schema'
import { readTextDefaults } from '../../../_lib/widget-form'
import { FormRow } from './form-row'

type Props = {
  entry: unknown
  onChange: (values: unknown) => void
  formId: string
  onSubmit: () => void
}

export function TextForm({ entry, onChange, formId, onSubmit }: Props) {
  const titleId = useId()
  const bodyId = useId()
  const toneId = useId()

  const form = useLiveWidgetForm<TextWidget>(
    {
      resolver: zodResolver(textWidgetSchema),
      defaultValues: readTextDefaults(entry),
      mode: 'onChange',
    },
    onChange,
  )

  const errors = form.formState.errors

  return (
    <form id={formId} className="flex flex-col gap-3" onSubmit={form.handleSubmit(onSubmit)}>
      <FormRow label="Title" controlId={titleId} error={errors.title?.message}>
        <input id={titleId} className={FORM_CONTROL_CLASS} {...form.register('title')} />
      </FormRow>

      <FormRow
        label="Body"
        controlId={bodyId}
        error={errors.body?.message}
        hint="Bold, italic, inline code and bullet lists. No links, no HTML."
      >
        <textarea
          id={bodyId}
          rows={6}
          className="border-border bg-surface-raised text-fg w-full rounded-md border p-2 text-sm"
          {...form.register('body')}
        />
      </FormRow>

      <FormRow label="Tone" controlId={toneId} error={errors.tone?.message}>
        <select id={toneId} className={FORM_CONTROL_CLASS} {...form.register('tone')}>
          {TEXT_TONES.map((tone) => (
            <option key={tone} value={tone}>
              {tone}
            </option>
          ))}
        </select>
      </FormRow>
    </form>
  )
}
