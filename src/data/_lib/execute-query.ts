import type { Aggregate, TimeBucket } from '@/constants/data'
import { err, ok, type Result } from '@/lib/result'
import type { DataRow, DatasetField, DataValue } from '@/types/data'

import { MAX_SERIES_PER_CHART } from '../_constants'
import type {
  DataError,
  DataFilter,
  DataQuery,
  DataResult,
  DataSort,
  EffectiveDataset,
  ResolvedColumn,
  ResolvedField,
  ResolvedSort,
  SeriesBinding,
  SeriesDescriptor,
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
        field: describe(field.data),
      })
    }

    case 'rows': {
      // Columns resolve one at a time: a table with one missing column is still a table.
      const columns: ResolvedColumn[] = select.fields.map((name) => {
        const field = findField(dataset, name)
        return field.ok
          ? { kind: 'resolved', field: describe(field.data) }
          : { kind: 'unresolved', name, available: fieldNames(dataset) }
      })

      const resolvedNames = columns.flatMap((column) =>
        column.kind === 'resolved' ? [column.field.name] : [],
      )

      const sorted = sortRows(rows, select.sort, dataset)

      return ok({
        kind: 'rows',
        rows: sorted.rows.slice(0, select.limit).map((row) => project(row, resolvedNames)),
        matchedRows: rows.length,
        columns,
        sort: sorted.sort,
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

      if (select.groupBy === null) {
        const series: SeriesDescriptor[] = select.series.map((binding) => ({
          key: binding.key,
          field: describeByName(dataset, binding.field),
          groupValue: null,
        }))

        return ok({
          kind: 'series',
          points: buildSeries(rows, xField.data, select.x.bucket, select.series),
          matchedRows: rows.length,
          x: describe(xField.data),
          series,
          groupBy: null,
        })
      }

      return groupedSeries(
        rows,
        dataset,
        xField.data,
        select.x.bucket,
        select.series,
        select.groupBy,
      )
    }
  }
}

function fieldNames(dataset: EffectiveDataset) {
  return dataset.schema.fields.map((candidate) => candidate.name)
}

function describe(field: DatasetField): ResolvedField {
  return { name: field.name, type: field.type, unit: field.unit }
}

function describeByName(dataset: EffectiveDataset, name: string): ResolvedField {
  const field = dataset.schema.fields.find((candidate) => candidate.name === name)
  return field ? describe(field) : { name, type: 'text', unit: null }
}

function findField(dataset: EffectiveDataset, name: string): Result<DatasetField, DataError> {
  const field = dataset.schema.fields.find((candidate) => candidate.name === name)
  if (field) return ok(field)

  return err({
    kind: 'unknown-field',
    dataset: dataset.schema.dataset,
    field: name,
    available: fieldNames(dataset),
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

/**
 * A sort field that no longer exists does not cost the reader their rows. The rows come back
 * in their natural order and the result says the sort could not be applied, so the table can
 * say so rather than implying an order it does not have.
 */
function sortRows(
  rows: ReadonlyArray<DataRow>,
  sort: DataSort | null,
  dataset: EffectiveDataset,
): { rows: DataRow[]; sort: ResolvedSort | null } {
  if (!sort) return { rows: [...rows], sort: null }

  const field = findField(dataset, sort.field)
  if (!field.ok) return { rows: [...rows], sort: { kind: 'unresolved', field: sort.field } }

  const direction = sort.direction === 'desc' ? -1 : 1
  const sorted = [...rows].sort(
    (left, right) => compare(left[sort.field] ?? null, right[sort.field] ?? null) * direction,
  )

  return { rows: sorted, sort: { kind: 'applied', field: sort.field, direction: sort.direction } }
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

  if (bucket === 'month') {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  }

  if (bucket === 'week') {
    const start = new Date(date)
    start.setUTCDate(date.getUTCDate() - date.getUTCDay())
    return start.toISOString().slice(0, 10)
  }

  return date.toISOString().slice(0, 10)
}

function groupRowsByX(
  rows: ReadonlyArray<DataRow>,
  xField: DatasetField,
  bucket: TimeBucket | null,
) {
  const groups = new Map<string, DataRow[]>()

  for (const row of rows) {
    const key = bucketKey(row[xField.name] ?? null, xField.type === 'date' ? bucket : null)
    const group = groups.get(key)
    if (group) group.push(row)
    else groups.set(key, [row])
  }

  return groups
}

function buildSeries(
  rows: ReadonlyArray<DataRow>,
  xField: DatasetField,
  bucket: TimeBucket | null,
  bindings: ReadonlyArray<SeriesBinding>,
): SeriesPoint[] {
  return [...groupRowsByX(rows, xField, bucket).entries()]
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

/** One series per distinct value of the group by field, capped so a chart stays readable. */
function groupedSeries(
  rows: ReadonlyArray<DataRow>,
  dataset: EffectiveDataset,
  xField: DatasetField,
  bucket: TimeBucket | null,
  bindings: ReadonlyArray<SeriesBinding>,
  groupBy: string,
): Result<DataResult, DataError> {
  const groupField = findField(dataset, groupBy)
  if (!groupField.ok) return groupField

  const binding = bindings[0]
  if (!binding) {
    return err({
      kind: 'unknown-field',
      dataset: dataset.schema.dataset,
      field: groupBy,
      available: fieldNames(dataset),
    })
  }

  const groupValues = [
    ...new Set(rows.map((row) => String(row[groupField.data.name] ?? 'unknown'))),
  ].sort()

  if (groupValues.length > MAX_SERIES_PER_CHART) {
    return err({
      kind: 'too-many-series',
      dataset: dataset.schema.dataset,
      field: groupBy,
      found: groupValues.length,
      limit: MAX_SERIES_PER_CHART,
    })
  }

  // The descriptor names the field being measured, not the field being grouped by: the
  // series is "billed amount, for this payer", and formatting follows the amount.
  const measured = describeByName(dataset, binding.field)

  const series: SeriesDescriptor[] = groupValues.map((value, index) => ({
    key: `g${index}`,
    field: measured,
    groupValue: value,
  }))

  const points = [...groupRowsByX(rows, xField, bucket).entries()]
    .map(([x, group]) => ({
      x,
      values: Object.fromEntries(
        series.map((descriptor) => {
          const inGroup = group.filter(
            (row) => String(row[groupField.data.name] ?? 'unknown') === descriptor.groupValue,
          )
          const value = aggregate(inGroup, binding.field, binding.aggregate)
          return [descriptor.key, typeof value === 'number' ? value : null]
        }),
      ),
    }))
    .sort((left, right) => left.x.localeCompare(right.x))

  return ok({
    kind: 'series',
    points,
    matchedRows: rows.length,
    x: describe(xField),
    series,
    groupBy: describe(groupField.data),
  })
}
