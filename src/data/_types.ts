import type { Aggregate, FieldType, FieldUnit, TimeBucket } from '@/constants/data'
import type { DataRow, DatasetSchema, DataValue } from '@/types/data'

/** Predicates, not dashboard filter kinds: the data layer knows nothing about the UI. */
export type DataFilter =
  | { kind: 'equals'; field: string; value: string }
  | { kind: 'in'; field: string; values: string[] }
  | { kind: 'date-range'; field: string; from: string; to: string }
  | { kind: 'contains'; field: string; value: string }

export type DataSort = { field: string; direction: 'asc' | 'desc' }

export type SeriesBinding = { key: string; field: string; aggregate: Aggregate }

export type DataSelect =
  | { kind: 'aggregate'; field: string; aggregate: Aggregate }
  | { kind: 'rows'; fields: string[]; sort: DataSort | null; limit: number }
  | {
      kind: 'series'
      x: { field: string; bucket: TimeBucket | null }
      series: SeriesBinding[]
      /** One series per distinct value of this field, instead of one series per binding. */
      groupBy: string | null
    }

export type DataQuery = {
  dataset: string
  filters: DataFilter[]
  select: DataSelect
}

export type SeriesPoint = { x: string; values: Record<string, number | null> }

/** What a result says about the fields it was computed from, as they are right now. */
export type ResolvedField = { name: string; type: FieldType; unit: FieldUnit | null }

/**
 * A table column resolves on its own. One missing column does not cost the reader the other
 * nine, so the column carries its own verdict rather than failing the whole query.
 */
export type ResolvedColumn =
  | { kind: 'resolved'; field: ResolvedField }
  | { kind: 'unresolved'; name: string; available: string[] }

export type ResolvedSort =
  | { kind: 'applied'; field: string; direction: DataSort['direction'] }
  | { kind: 'unresolved'; field: string }

export type SeriesDescriptor = {
  key: string
  field: ResolvedField
  /** The value of the group by field this series covers, when the chart groups. */
  groupValue: string | null
}

export type DataResult =
  | { kind: 'value'; value: DataValue; matchedRows: number; field: ResolvedField }
  | {
      kind: 'rows'
      rows: DataRow[]
      matchedRows: number
      columns: ResolvedColumn[]
      sort: ResolvedSort | null
    }
  | {
      kind: 'series'
      points: SeriesPoint[]
      matchedRows: number
      x: ResolvedField
      series: SeriesDescriptor[]
      /** The field the series were split by, when the chart groups. */
      groupBy: ResolvedField | null
    }

/**
 * Why a request could not answer. The three binding kinds are separated from the three
 * transport kinds because they need different words on the tile and different retry
 * behaviour: waiting does not bring back a field that was renamed.
 */
export type DataError =
  | { kind: 'request-failed'; message: string }
  | { kind: 'timeout'; timeoutMs: number }
  | { kind: 'aborted' }
  | { kind: 'corrupt-response'; message: string }
  | { kind: 'unknown-dataset'; dataset: string; available: string[] }
  | { kind: 'unknown-field'; dataset: string; field: string; available: string[] }
  | { kind: 'field-type'; dataset: string; field: string; actual: FieldType; expected: string }
  | { kind: 'too-many-series'; dataset: string; field: string; found: number; limit: number }

export type EffectiveDataset = {
  schema: DatasetSchema
  rows: DataRow[]
}
