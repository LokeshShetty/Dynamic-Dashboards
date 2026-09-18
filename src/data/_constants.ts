export const DATASET_IDS = ['claims', 'providers', 'credentialing_applications'] as const

/**
 * The world is generated from a fixed seed and anchored to a fixed date, so two reviewers
 * looking at the same dashboard see the same numbers and the shipped date filters keep
 * matching data however long from now this is opened.
 */
export const WORLD_SEED = 20260915
export const WORLD_ANCHOR_ISO = '2026-09-15T00:00:00.000Z'
export const WORLD_WINDOW_DAYS = 90

export const DATASET_ROW_COUNTS = {
  claims: 800,
  providers: 60,
  credentialing_applications: 150,
} as const

/** How many lines one chart may carry before it stops being readable. */
export const MAX_SERIES_PER_CHART = 8

/** How many rows a table fetches, so sorting and paging can happen without a round trip. */
export const TABLE_FETCH_LIMIT = 200

/** A request that has not answered in this long is treated as never answering. */
export const REQUEST_TIMEOUT_MS = 8_000

/** One attempt plus two retries, backing off between them. */
export const MAX_DATA_ATTEMPTS = 3
export const RETRY_BASE_DELAY_MS = 500
export const RETRY_MAX_DELAY_MS = 4_000

export type DatasetId = (typeof DATASET_IDS)[number]
