/** How long a control waits after typing stops before it acts on what was typed. */
export const SEARCH_DEBOUNCE_MS = 200
export const FILTER_DEBOUNCE_MS = 250

/** How long a toast stays before dismissing itself, unless it is hovered or focused. */
export const TOAST_DISMISS_MS = 5000

/**
 * The shape every small control shares: filter inputs, form inputs, the dropdown trigger, the
 * selects in the chaos panel. It was the same string written out in four places.
 */
export const CONTROL_CLASS =
  'border-border bg-surface-raised text-fg h-8 w-full rounded-md border px-2 text-xs'

/** The same control at the size the editor form uses. */
export const FORM_CONTROL_CLASS =
  'border-border bg-surface-raised text-fg h-8 w-full rounded-md border px-2 text-sm'
