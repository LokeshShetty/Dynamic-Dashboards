import type { FieldType } from '@/constants/data'

/** Conditions the data layer operates under. None of these change what is true. */
export type ChaosSettings = {
  latencyMs: number
  jitterMs: number
  /** 0 to 1. The share of requests that fail outright. */
  failureRate: number
  /** 0 to 1. The share of requests that never answer, so the request times out. */
  timeoutRate: number
  /** Set once, spent on the next response, which arrives malformed. */
  corruptNextResponse: boolean
}

/**
 * Changes to the world itself: a field is renamed, a type changes, a dataset disappears.
 * These do change what is true, so every one of them bumps the epoch and every widget refetches.
 */
export type ChaosMutations = {
  /** dataset -> original field name -> the name it answers to now. */
  renamedFields: Record<string, Record<string, string>>
  /** dataset -> field name -> the type it reports and serves now. */
  retypedFields: Record<string, Record<string, FieldType>>
  droppedDatasets: string[]
}

export type ChaosSnapshot = ChaosSettings &
  ChaosMutations & {
    /** Bumped by every mutation. It is part of every query key, so nothing stale survives one. */
    epoch: number
  }
