import { createParser, debounce, type ParserBuilder } from 'nuqs'
import { z } from 'zod'

import { CONFIG_LIMITS } from '../_constants'
import type { DashboardFilter } from './config.schema'
import type { FilterValues } from './to-data-query'

/**
 * Filter values live in the URL as one readable parameter per control, never as a JSON blob:
 * ?f_status=paid&f_payer=Cascade+Mutual,Northwind+Care&f_submitted_from=2026-08-01
 *
 * The URL is input like any other, so every parameter is validated by the same zod schemas the
 * configuration uses. A value that does not validate is ignored in favour of the configured
 * default, and the bar says which parameter it ignored.
 */
export const FILTER_PARAM_PREFIX = 'f_'

const valueSchema = z.string().min(1).max(CONFIG_LIMITS.MAX_LABEL_CHARS)
const listSchema = z.array(valueSchema).min(1).max(CONFIG_LIMITS.MAX_SELECT_OPTIONS)
const dateSchema = z.iso.date()
const searchSchema = z.string().min(1).max(CONFIG_LIMITS.MAX_LABEL_CHARS)

export const FILTER_VALUE_SCHEMAS = {
  value: valueSchema,
  list: listSchema,
  date: dateSchema,
  search: searchSchema,
} as const

export function paramNamesFor(filter: DashboardFilter): string[] {
  if (filter.kind === 'date-range') {
    return [`${FILTER_PARAM_PREFIX}${filter.id}_from`, `${FILTER_PARAM_PREFIX}${filter.id}_to`]
  }
  return [`${FILTER_PARAM_PREFIX}${filter.id}`]
}

/** Values are comma separated in the URL, so a value containing a comma is rejected, not split. */
function splitList(raw: string): string[] | null {
  if (raw.includes(',,')) return null
  const parts = raw.split(',').map((part) => part.trim())
  const parsed = listSchema.safeParse(parts)
  return parsed.success ? parsed.data : null
}

const parseValue = createParser({
  parse: (raw) => {
    const parsed = valueSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  },
  serialize: (value: string) => value,
})

const parseList = createParser({
  parse: splitList,
  serialize: (values: string[]) => values.join(','),
  eq: (left: string[], right: string[]) =>
    left.length === right.length && left.every((value, index) => value === right[index]),
})

const parseDate = createParser({
  parse: (raw) => {
    const parsed = dateSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  },
  serialize: (value: string) => value,
})

const parseSearch = createParser({
  parse: (raw) => {
    const parsed = searchSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  },
  serialize: (value: string) => value,
})

export type FilterParsers = Record<string, ParserBuilder<string> | ParserBuilder<string[]>>

/**
 * One parser per parameter, carrying the configured default. Discrete controls push a history
 * entry, so the back button walks through filter changes; the search box replaces, because a
 * history entry per pause in typing is noise rather than navigation.
 */
export function buildFilterParsers(filters: ReadonlyArray<DashboardFilter>) {
  const parsers: Record<string, ReturnType<typeof parseValue.withDefault>> = {}
  const lists: Record<string, ReturnType<typeof parseList.withDefault>> = {}

  for (const filter of filters) {
    const [first, second] = paramNamesFor(filter)
    if (first === undefined) continue

    switch (filter.kind) {
      case 'select':
        parsers[first] = parseValue
          .withOptions({ history: 'push' })
          .withDefault(filter.defaultValue ?? '')
        break

      case 'multi-select':
        lists[first] = parseList
          .withOptions({ history: 'push' })
          .withDefault(filter.defaultValue ?? [])
        break

      case 'date-range':
        parsers[first] = parseDate
          .withOptions({ history: 'push' })
          .withDefault(filter.defaultValue?.from ?? '')
        if (second !== undefined) {
          parsers[second] = parseDate
            .withOptions({ history: 'push' })
            .withDefault(filter.defaultValue?.to ?? '')
        }
        break

      case 'search':
        parsers[first] = parseSearch
          .withOptions({ history: 'replace', limitUrlUpdates: debounce(250) })
          .withDefault(filter.defaultValue ?? '')
        break
    }
  }

  return { parsers, lists }
}

export type IgnoredParam = { param: string; value: string; reason: string }

export type FilterUrlState = {
  values: FilterValues
  ignored: IgnoredParam[]
}

/**
 * Turns the validated parameters into filter values, and reports the parameters that were
 * thrown away. Nothing here silently repairs a value: a parameter either survives validation
 * or the configured default is used and the bar says so.
 */
export function toFilterUrlState(
  filters: ReadonlyArray<DashboardFilter>,
  strings: Record<string, string>,
  lists: Record<string, string[]>,
  rawParams: URLSearchParams,
): FilterUrlState {
  const values: FilterValues = {}
  const ignored: IgnoredParam[] = []

  const reportRejected = (param: string, schema: z.ZodType<unknown>) => {
    const raw = rawParams.get(param)
    if (raw === null) return
    const parsed = schema.safeParse(raw)
    if (parsed.success) return
    ignored.push({
      param,
      value: raw,
      reason: parsed.error.issues[0]?.message ?? 'not a value this filter accepts',
    })
  }

  for (const filter of filters) {
    const [first, second] = paramNamesFor(filter)
    if (first === undefined) continue

    switch (filter.kind) {
      case 'select': {
        reportRejected(first, valueSchema)
        const value = strings[first] ?? ''
        values[filter.id] = value === '' ? null : value
        break
      }

      case 'search': {
        reportRejected(first, searchSchema)
        const value = strings[first] ?? ''
        values[filter.id] = value === '' ? null : value
        break
      }

      case 'multi-select': {
        const raw = rawParams.get(first)
        if (raw !== null && splitList(raw) === null) {
          ignored.push({ param: first, value: raw, reason: 'not a comma separated list of values' })
        }
        const value = lists[first] ?? []
        values[filter.id] = value.length === 0 ? null : value
        break
      }

      case 'date-range': {
        reportRejected(first, dateSchema)
        if (second !== undefined) reportRejected(second, dateSchema)

        const from = strings[first] ?? ''
        const to = second === undefined ? '' : (strings[second] ?? '')
        values[filter.id] = readRange(filter, from, to, first, second, ignored)
        break
      }
    }
  }

  return { values, ignored }
}

/** A range needs both ends. A half range falls back to the configured end, or to nothing. */
function readRange(
  filter: Extract<DashboardFilter, { kind: 'date-range' }>,
  from: string,
  to: string,
  fromParam: string,
  toParam: string | undefined,
  ignored: IgnoredParam[],
): { from: string; to: string } | null {
  const filledFrom = from === '' ? (filter.defaultValue?.from ?? '') : from
  const filledTo = to === '' ? (filter.defaultValue?.to ?? '') : to

  if (filledFrom === '' || filledTo === '') {
    if (from !== '' || to !== '') {
      ignored.push({
        param: from === '' ? (toParam ?? fromParam) : fromParam,
        value: from === '' ? to : from,
        reason: 'a date range needs both ends, and this filter has no default for the other one',
      })
    }
    return null
  }

  if (filledFrom > filledTo) {
    ignored.push({
      param: `${fromParam} and ${toParam ?? fromParam}`,
      value: `${filledFrom} to ${filledTo}`,
      reason:
        'the range ends before it starts, and swapping the ends would answer a different question',
    })
    return filter.defaultValue ?? null
  }

  return { from: filledFrom, to: filledTo }
}

/** How many controls differ from what the configuration shipped. */
export function countActiveFilters(
  filters: ReadonlyArray<DashboardFilter>,
  values: FilterValues,
): number {
  return filters.filter((filter) => {
    const current = values[filter.id] ?? null
    const configured = filter.defaultValue ?? null
    return JSON.stringify(current) !== JSON.stringify(configured)
  }).length
}
