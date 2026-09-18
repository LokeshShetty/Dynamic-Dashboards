import type { ChaosMutations, ChaosSettings } from '@/types/chaos'

/**
 * Slow enough and unreliable enough that a reviewer meets the loading, retry and error
 * states without touching a control.
 */
export const DEFAULT_CHAOS_SETTINGS: ChaosSettings = {
  latencyMs: 1200,
  jitterMs: 800,
  failureRate: 0.1,
  timeoutRate: 0.02,
  corruptNextResponse: false,
}

export const EMPTY_CHAOS_MUTATIONS: ChaosMutations = {
  renamedFields: {},
  retypedFields: {},
  droppedDatasets: [],
}

/** Query string names, so a reviewer can make things worse from the address bar. */
export const CHAOS_PARAMS = {
  LATENCY: 'latency',
  JITTER: 'jitter',
  FAILURE_RATE: 'failRate',
  TIMEOUT_RATE: 'timeoutRate',
} as const

export const CHAOS_LIMITS = {
  MAX_LATENCY_MS: 30_000,
  MAX_JITTER_MS: 10_000,
} as const
