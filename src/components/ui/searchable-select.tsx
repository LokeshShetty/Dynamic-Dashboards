import { useCallback, useRef, useState } from 'react'

import { Check, ChevronDown, X } from 'lucide-react'

import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useDismissOnOutside } from '@/hooks/use-dismiss-on-outside'
import { cn } from '@/lib/utils'

import { Button } from './button'

const SEARCH_DEBOUNCE_MS = 200

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

type Props = {
  id: string
  /** Names the control for assistive technology when the visible label is elsewhere. */
  label: string
  options: SelectOption[]
  selection: SelectSelection
  emptyLabel: string
  className?: string
}

/**
 * One dropdown for every list that comes from data: dataset fields, filter values, anything that
 * can be four entries today and four hundred tomorrow. A native select cannot be searched and a
 * row of chips cannot be scanned, so this is a trigger and a panel of native inputs: radios when
 * one value is being chosen, checkboxes when several are, which keeps the keyboard behaviour the
 * browser already provides.
 *
 * Every list gets the search box, however short it looks today: the values come from data, and a
 * field with four values this week can have forty next week. Filtering runs on a debounced term,
 * so typing stays smooth over a few hundred values while the field itself updates on every
 * keystroke.
 */
export function SearchableSelect({ id, label, options, selection, emptyLabel, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const settled = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)

  // An empty box filters nothing, at once. Waiting out the debounce to clear a filter would show
  // a list with values missing from it for a moment after it was already emptied.
  const term = search === '' ? '' : settled.trim().toLowerCase()

  // Closing clears the search: reopening a list already filtered by something typed a while ago
  // looks like a list with values missing from it.
  const close = useCallback(() => {
    setIsOpen(false)
    setSearch('')
  }, [])

  useDismissOnOutside(containerRef, isOpen, close)

  const selected =
    selection.mode === 'single'
      ? new Set(selection.value === null ? [] : [selection.value])
      : new Set(selection.values)

  const matching = term === '' ? options : options.filter((option) => matches(option, term))

  const summary = () => {
    if (selected.size === 0) return emptyLabel
    if (selected.size === 1) {
      const only = [...selected][0]
      return options.find((option) => option.value === only)?.label ?? only ?? emptyLabel
    }
    return `${selected.size} selected`
  }

  const choose = (option: SelectOption) => {
    if (selection.mode === 'single') {
      selection.onChange(option.value)
      close()
      return
    }

    const next = new Set(selection.values)
    if (next.has(option.value)) next.delete(option.value)
    else next.add(option.value)
    selection.onChange([...next])
  }

  const clear = () => {
    if (selection.mode === 'single') selection.onChange(null)
    else selection.onChange([])
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        id={id}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="border-border bg-surface-raised text-fg flex h-8 w-full items-center justify-between gap-2 rounded-md border px-2 text-left text-xs"
        onClick={() => (isOpen ? close() : setIsOpen(true))}
      >
        <span className={cn('truncate', selected.size === 0 ? 'text-fg-muted' : 'text-fg')}>
          {summary()}
        </span>
        <ChevronDown aria-hidden="true" className="size-3 shrink-0" />
      </button>

      {isOpen ? (
        <div className="border-border bg-surface-raised absolute z-30 mt-1 flex w-72 max-w-[90vw] flex-col gap-2 rounded-md border p-2 shadow-xl">
          <input
            type="search"
            aria-label={`Search ${label.toLowerCase()}`}
            placeholder="Search"
            className="border-border bg-surface-raised text-fg h-8 w-full rounded-md border px-2 text-xs"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <ul className="flex max-h-56 flex-col overflow-auto">
            {matching.map((option) => (
              <li key={option.value}>
                <label className="hover:bg-surface-muted flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs">
                  <input
                    type={selection.mode === 'single' ? 'radio' : 'checkbox'}
                    name={selection.mode === 'single' ? id : undefined}
                    className="accent-accent"
                    checked={selected.has(option.value)}
                    onChange={() => choose(option)}
                  />
                  <span className="truncate">{option.label}</span>
                  {option.hint === undefined ? null : (
                    <span className="text-fg-subtle shrink-0">{option.hint}</span>
                  )}
                  {option.isMissing ? (
                    <span className="text-warning ml-auto shrink-0">not in data</span>
                  ) : null}
                  {selected.has(option.value) ? (
                    <Check aria-hidden="true" className="text-accent ml-auto size-3 shrink-0" />
                  ) : null}
                </label>
              </li>
            ))}

            {matching.length === 0 ? (
              <li className="text-fg-muted px-1 py-2 text-xs">Nothing matches “{search}”</li>
            ) : null}
          </ul>

          <div className="border-border flex items-center justify-between border-t pt-2">
            <span className="text-fg-subtle text-xs tabular-nums">
              {selected.size} of {options.length}
            </span>
            <Button size="sm" variant="ghost" disabled={selected.size === 0} onClick={clear}>
              <X aria-hidden="true" className="size-3" />
              Clear
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function matches(option: SelectOption, term: string) {
  return (
    option.label.toLowerCase().includes(term) ||
    option.value.toLowerCase().includes(term) ||
    (option.hint ?? '').toLowerCase().includes(term)
  )
}
