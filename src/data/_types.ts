import type { Aggregate, FieldType, TimeBucket } from '@/constants/data'
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
  | { kind: 'series'; x: { field: string; bucket: TimeBucket | null }; series: SeriesBinding[] }

export type DataQuery = {
  dataset: string
  filters: DataFilter[]
  select: DataSelect
}

export type SeriesPoint = { x: string; values: Record<string, number | null> }

export type DataResult =
  | { kind: 'value'; value: DataValue; matchedRows: number }
  | { kind: 'rows'; rows: DataRow[]; matchedRows: number }
  | { kind: 'series'; points: SeriesPoint[]; matchedRows: number }

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

export type EffectiveDataset = {
  schema: DatasetSchema
  rows: DataRow[]
}
