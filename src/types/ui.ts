/**
 * Types the hand written UI primitives share with their callers. They live here rather than in
 * the component file because more than one feature builds options for the same dropdown.
 */
export type SelectOption = {
  value: string
  label: string
  /** Shown after the label, for a field's type or a value that is no longer in the data. */
  hint?: string
  isMissing?: boolean
}

export type SelectSelection =
  | { mode: 'single'; value: string | null; onChange: (value: string | null) => void }
  | { mode: 'multiple'; values: string[]; onChange: (values: string[]) => void }
