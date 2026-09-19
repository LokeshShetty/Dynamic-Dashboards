/**
 * Bidirectional control characters let text reorder what is printed around it, so a widget
 * title can make the rest of a line read backwards or hide what it really says. Configuration
 * text is written by people and pasted from anywhere, so the controls are stripped before it
 * reaches the page, and what is left is isolated in a bdi element so it cannot reorder its
 * neighbours either.
 */
const BIDI_CONTROLS = /[؜‎‏‪-‮⁦-⁩]/g

export function stripBidiControls(text: string): string {
  return text.replace(BIDI_CONTROLS, '')
}

/** Words that read as initials rather than as words. */
const ACRONYMS: Record<string, string> = { id: 'ID', npi: 'NPI', ids: 'IDs' }

/** Suffixes that describe the unit rather than the thing, once the unit is known. */
const UNIT_SUFFIXES: Record<string, string> = {
  cents: '_cents',
  days: '_days',
  percent: '_percent',
}

/**
 * A field name as a reader should see it. Column keys are how the data names things, not how
 * people do: "avg of line_items" is the database talking, "Average of Line items" is the
 * dashboard talking. Where the unit is known and the name carries it as a suffix, the suffix
 * goes, because the formatter already shows it.
 */
export function humanizeFieldName(name: string, unit?: string | null): string {
  const suffix = unit === undefined || unit === null ? undefined : UNIT_SUFFIXES[unit]
  const base = suffix !== undefined && name.endsWith(suffix) ? name.slice(0, -suffix.length) : name

  const words = base
    .split(/[_\s]+/)
    .filter((word) => word !== '')
    .map((word) => ACRONYMS[word.toLowerCase()] ?? word.toLowerCase())

  const [first, ...rest] = words
  if (first === undefined) return name

  const head = ACRONYMS[first.toLowerCase()] ?? `${first.charAt(0).toUpperCase()}${first.slice(1)}`

  return [head, ...rest].join(' ')
}
