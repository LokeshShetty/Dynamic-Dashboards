export const STORAGE_KEY_PREFIX = 'dashboard:'
export const STORAGE_INDEX_KEY = 'dashboard:index'
export const STORAGE_SEED_KEY = 'dashboard:seeded'

/**
 * localStorage is a few megabytes for the whole origin, so history is capped rather than
 * unbounded. The oldest revision is dropped when the cap is reached, and the UI says so.
 */
export const MAX_REVISIONS_PER_DASHBOARD = 30

export const SAVE_CHANNEL_NAME = 'custom-dashboard:saves'
