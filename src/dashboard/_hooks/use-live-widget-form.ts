import { useEffect, useRef } from 'react'

import { useForm, useWatch, type FieldValues, type UseFormProps } from 'react-hook-form'

/**
 * A form whose every keystroke reaches the draft. The tile behind the dialog re-renders through
 * the same frame the reader gets, so a binding that will not resolve says so while it is being
 * typed rather than after it is saved.
 */
export function useLiveWidgetForm<TValues extends FieldValues>(
  options: UseFormProps<TValues>,
  onChange: (values: unknown) => void,
) {
  const form = useForm<TValues>(options)
  const values = useWatch({ control: form.control })
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Only a change in the values writes to the draft. Depending on the callback as well would
  // loop: writing to the draft re-renders the editor, which hands this hook a new callback.
  useEffect(() => {
    onChangeRef.current(values)
  }, [values])

  return form
}
