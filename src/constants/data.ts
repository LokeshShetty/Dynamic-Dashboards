/** Vocabulary shared by the configuration format and the data layer. */
export const FIELD_TYPES = ['text', 'number', 'date', 'boolean'] as const
export const AGGREGATES = ['sum', 'avg', 'min', 'max', 'count', 'first', 'last'] as const
export const TIME_BUCKETS = ['day', 'week', 'month'] as const

/**
 * What the numbers in a field actually are. Money is the one that matters for presentation:
 * a currency format is only meaningful over a field that holds money, and amounts here are
 * stored in cents, so the formatter divides rather than guessing.
 */
export const FIELD_UNITS = ['cents', 'days', 'percent'] as const
export const MONEY_UNITS = ['cents'] as const

/** Aggregates that only mean something over numbers. */
export const NUMERIC_AGGREGATES = ['sum', 'avg'] as const

/** Aggregates that need an ordered field, which here means numbers or dates. */
export const ORDERED_AGGREGATES = ['min', 'max'] as const

export type FieldType = (typeof FIELD_TYPES)[number]
export type Aggregate = (typeof AGGREGATES)[number]
export type TimeBucket = (typeof TIME_BUCKETS)[number]
export type FieldUnit = (typeof FIELD_UNITS)[number]

export function isMoneyUnit(unit: FieldUnit | null): boolean {
  return unit !== null && MONEY_UNITS.some((candidate) => candidate === unit)
}
