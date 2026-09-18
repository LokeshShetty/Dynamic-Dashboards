import type { DatasetSchema } from '@/types/data'

import type { DataResult } from '../_types'

/**
 * Damage a payload the way a real source would: a number that is not a number, a row that is
 * not a row, a point with no x. Every one of these is caught by the response schema, which is
 * the point of the control.
 */
export function corruptDataResult(result: DataResult): unknown {
  switch (result.kind) {
    case 'value':
      return { kind: 'value', value: Number.NaN, matchedRows: 'several' }

    case 'rows':
      return {
        kind: 'rows',
        rows: [...result.rows.slice(0, 2), null, 'not a row'],
        matchedRows: -1,
      }

    case 'series':
      return {
        kind: 'series',
        points: result.points.map((point) => ({ values: point.values })),
        matchedRows: result.matchedRows,
        x: result.x,
        series: result.series,
        groupBy: result.groupBy,
        skippedFilters: result.skippedFilters,
      }
  }
}

export function corruptDatasetSchema(schema: DatasetSchema): unknown {
  return {
    dataset: schema.dataset,
    fields: schema.fields.map((field) => ({
      name: field.name,
      type: 'mystery',
      nullable: null,
      unit: 'furlongs',
    })),
    rowCount: 'lots',
  }
}
