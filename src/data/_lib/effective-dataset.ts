import type { FieldType } from '@/constants/data'
import { err, ok, type Result } from '@/lib/result'
import type { ChaosMutations } from '@/types/chaos'
import type { DataRow, DatasetField, DataValue } from '@/types/data'

import type { DataError, EffectiveDataset } from '../_types'
import { readWorld, worldDatasetIds } from './world'

/**
 * The world as it looks right now, with chaos applied as a view over immutable data: a
 * renamed field answers only to its new name, a retyped field reports and serves the new
 * type, and a dropped dataset is gone. This is what makes binding drift real rather than
 * cosmetic: a configuration written yesterday can stop resolving without being edited.
 */
export function readEffectiveDataset(
  dataset: string,
  mutations: ChaosMutations,
): Result<EffectiveDataset, DataError> {
  const available = worldDatasetIds().filter((id) => !mutations.droppedDatasets.includes(id))

  if (mutations.droppedDatasets.includes(dataset)) {
    return err({ kind: 'unknown-dataset', dataset, available })
  }

  const base = readWorld(dataset)
  if (!base) return err({ kind: 'unknown-dataset', dataset, available })

  const renames = mutations.renamedFields[dataset] ?? {}
  const retypes = mutations.retypedFields[dataset] ?? {}

  if (Object.keys(renames).length === 0 && Object.keys(retypes).length === 0) {
    return ok({ schema: base.schema, rows: base.rows })
  }

  const fields: DatasetField[] = base.schema.fields.map((field) => ({
    ...field,
    name: renames[field.name] ?? field.name,
    type: retypes[field.name] ?? field.type,
  }))

  const rows: DataRow[] = base.rows.map((row) => {
    const next: DataRow = {}
    for (const field of base.schema.fields) {
      const name = renames[field.name] ?? field.name
      const retyped = retypes[field.name]
      const value = row[field.name] ?? null
      next[name] = retyped ? coerceValue(value, retyped) : value
    }
    return next
  })

  return ok({ schema: { dataset, fields, rowCount: rows.length }, rows })
}

/** What a field looks like after its type changed under a dashboard that was already saved. */
function coerceValue(value: DataValue, type: FieldType): DataValue {
  if (value === null) return null

  switch (type) {
    case 'text':
      return String(value)

    case 'number': {
      const asNumber = Number(value)
      return Number.isFinite(asNumber) ? asNumber : null
    }

    case 'date': {
      const asDate = new Date(typeof value === 'boolean' ? Number(value) : value)
      return Number.isNaN(asDate.getTime()) ? null : asDate.toISOString()
    }

    case 'boolean':
      return Boolean(value)
  }
}
