/** Vocabulary shared by the configuration format and the data layer. */
export const FIELD_TYPES = ['text', 'number', 'date', 'boolean'] as const
export const AGGREGATES = ['sum', 'avg', 'min', 'max', 'count', 'first', 'last'] as const
export const TIME_BUCKETS = ['day', 'week', 'month'] as const

/** Aggregates that only mean something over numbers. */
export const NUMERIC_AGGREGATES = ['sum', 'avg'] as const

/** Aggregates that need an ordered field, which here means numbers or dates. */
export const ORDERED_AGGREGATES = ['min', 'max'] as const

export type FieldType = (typeof FIELD_TYPES)[number]
export type Aggregate = (typeof AGGREGATES)[number]
export type TimeBucket = (typeof TIME_BUCKETS)[number]
