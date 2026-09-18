import type { Aggregate, TimeBucket } from '@/constants/data'
import { err, ok, type Result } from '@/lib/result'
import type { DataRow, DatasetField, DataValue } from '@/types/data'

import type {
  DataError,
  DataFilter,
  DataQuery,
  DataResult,
  DataSort,
  EffectiveDataset,
  SeriesBinding,
  SeriesPoint,
} from '../_types'

/**
 * Runs a query against the world as it is right now. Pure: the same dataset and query always
 * produce the same result, so anything surprising on screen came from the transport, not here.
 */
export function executeQuery(
  query: DataQuery,
  dataset: EffectiveDataset,
): Result<DataResult, DataError> {
  const filtered = applyFilters(query.filters, dataset)
  if (!filtered.ok) return filtered

  const rows = filtered.data
  const { select } = query

  switch (select.kind) {
    case 'aggregate': {
      const field = findField(dataset, select.field)
      if (!field.ok) return field

      const checked = checkAggregate(dataset, field.data, select.aggregate)
      if (!checked.ok) return checked

      return ok({
        kind: 'value',
        value: aggregate(rows, field.data.name, select.aggregate),
        matchedRows: rows.length,
      })
    }

    case 'rows': {
      for (const name of select.fields) {
        const field = findField(dataset, name)
        if (!field.ok) return field
      }

      const sorted = sortRows(rows, select.sort, dataset)
      if (!sorted.ok) return sorted

      return ok({
        kind: 'rows',
        rows: sorted.data.slice(0, select.limit).map((row) => project(row, select.fields)),
        matchedRows: rows.length,
      })
    }

    case 'series': {
      const xField = findField(dataset, select.x.field)
      if (!xField.ok) return xField

      for (const binding of select.series) {
        const field = findField(dataset, binding.field)
        if (!field.ok) return field

        const checked = checkAggregate(dataset, field.data, binding.aggregate)
        if (!checked.ok) return checked
      }

      return ok({
        kind: 'series',
        points: buildSeries(rows, xField.data, select.x.bucket, select.series),
        matchedRows: rows.length,
      })
    }
  }
}

function findField(dataset: EffectiveDataset, name: string): Result<DatasetField, DataError> {
  const field = dataset.schema.fields.find((candidate) => candidate.name === name)
  if (field) return ok(field)

  return err({
    kind: 'unknown-field',
    dataset: dataset.schema.dataset,
    field: name,
    available: dataset.schema.fields.map((candidate) => candidate.name),
  })
}

/** count works on anything, sums need numbers, extremes need something ordered. */
function checkAggregate(
  dataset: EffectiveDataset,
  field: DatasetField,
  aggregation: Aggregate,
): Result<true, DataError> {
  const fail = (expected: string): Result<true, DataError> =>
    err({
      kind: 'field-type',
      dataset: dataset.schema.dataset,
      field: field.name,
      actual: field.type,
      expected,
    })

  if ((aggregation === 'sum' || aggregation === 'avg') && field.type !== 'number') {
    return fail('a number field')
  }

  if ((aggregation === 'min' || aggregation === 'max') && field.type === 'boolean') {
    return fail('a number, date or text field')
  }

  return ok(true)
}

function applyFilters(
  filters: ReadonlyArray<DataFilter>,
  dataset: EffectiveDataset,
): Result<DataRow[], DataError> {
  let rows = dataset.rows

  for (const filter of filters) {
    const field = findField(dataset, filter.field)
    if (!field.ok) return field

    rows = rows.filter((row) => matches(row[filter.field] ?? null, filter))
  }

  return ok(rows)
}

function matches(value: DataValue, filter: DataFilter): boolean {
  if (value === null) return false

  switch (filter.kind) {
    case 'equals':
      return String(value) === filter.value

    case 'in':
      return filter.values.length === 0 || filter.values.includes(String(value))

    case 'date-range': {
      const time = Date.parse(String(value))
      if (Number.isNaN(time)) return false
      return (
        time >= Date.parse(`${filter.from}T00:00:00.000Z`) &&
        time <= Date.parse(`${filter.to}T23:59:59.999Z`)
      )
    }

    case 'contains':
      return String(value).toLowerCase().includes(filter.value.toLowerCase())
  }
}

function sortRows(
  rows: ReadonlyArray<DataRow>,
  sort: DataSort | null,
  dataset: EffectiveDataset,
): Result<DataRow[], DataError> {
  if (!sort) return ok([...rows])

  const field = findField(dataset, sort.field)
  if (!field.ok) return field

  const direction = sort.direction === 'desc' ? -1 : 1
  const sorted = [...rows].sort(
    (left, right) => compare(left[sort.field] ?? null, right[sort.field] ?? null) * direction,
  )

  return ok(sorted)
}

function compare(left: DataValue, right: DataValue): number {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right))
}

function project(row: DataRow, fields: ReadonlyArray<string>): DataRow {
  const projected: DataRow = {}
  for (const field of fields) projected[field] = row[field] ?? null
  return projected
}

function aggregate(rows: ReadonlyArray<DataRow>, field: string, aggregation: Aggregate): DataValue {
  const values = rows.map((row) => row[field] ?? null).filter((value) => value !== null)

  if (aggregation === 'count') return values.length
  if (values.length === 0) return null

  switch (aggregation) {
    case 'first':
      return values[0] ?? null

    case 'last':
      return values[values.length - 1] ?? null

    case 'min':
      return values.reduce((lowest, value) => (compare(value, lowest) < 0 ? value : lowest))

    case 'max':
      return values.reduce((highest, value) => (compare(value, highest) > 0 ? value : highest))

    case 'sum':
    case 'avg': {
      const numbers = values.filter((value) => typeof value === 'number')
      if (numbers.length === 0) return null
      const total = numbers.reduce((sum, value) => sum + value, 0)
      return aggregation === 'sum' ? total : total / numbers.length
    }
  }
}

function bucketKey(value: DataValue, bucket: TimeBucket | null): string {
  if (value === null) return 'unknown'
  if (!bucket) return String(value)

  const time = Date.parse(String(value))
  if (Number.isNaN(time)) return String(value)

  const date = new Date(time)

  if (bucket === 'month')
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`

  if (bucket === 'week') {
    const start = new Date(date)
    start.setUTCDate(date.getUTCDate() - date.getUTCDay())
    return start.toISOString().slice(0, 10)
  }

  return date.toISOString().slice(0, 10)
}

function buildSeries(
  rows: ReadonlyArray<DataRow>,
  xField: DatasetField,
  bucket: TimeBucket | null,
  bindings: ReadonlyArray<SeriesBinding>,
): SeriesPoint[] {
  const groups = new Map<string, DataRow[]>()

  for (const row of rows) {
    const key = bucketKey(row[xField.name] ?? null, xField.type === 'date' ? bucket : null)
    const group = groups.get(key)
    if (group) group.push(row)
    else groups.set(key, [row])
  }

  return [...groups.entries()]
    .map(([x, group]) => ({
      x,
      values: Object.fromEntries(
        bindings.map((binding) => {
          const value = aggregate(group, binding.field, binding.aggregate)
          return [binding.key, typeof value === 'number' ? value : null]
        }),
      ),
    }))
    .sort((left, right) => left.x.localeCompare(right.x))
}
