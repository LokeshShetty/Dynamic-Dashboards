import type { FieldType, FieldUnit } from '@/constants/data'

/** Every value a dataset cell can hold. Dates are ISO strings with a date field type. */
export type DataValue = string | number | boolean | null

export type DataRow = Record<string, DataValue>

export type DatasetField = {
  name: string
  type: FieldType
  nullable: boolean
  /** What the values mean, where the numbers alone do not say. */
  unit: FieldUnit | null
}

/**
 * What a dataset says about itself right now. A dashboard configuration is written against
 * one of these, and chaos can change it underneath a saved configuration at any time.
 */
export type DatasetSchema = {
  dataset: string
  fields: DatasetField[]
  rowCount: number
}
