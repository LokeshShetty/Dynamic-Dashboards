/** Narrows unknown JSON to a plain object without asserting anything about its contents. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/** Rejects NaN and Infinity, both of which JSON.parse can produce from a literal like 1e999. */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
