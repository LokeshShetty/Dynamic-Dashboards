import type { ChaosSnapshot } from '@/types/chaos'

import { DEFAULT_CHAOS_SETTINGS } from '../_constants'

/**
 * What is switched on, in as few words as fit on a chip. Only settings that differ from the
 * defaults are listed, so a reviewer can tell at a glance whether what they are looking at is
 * the shipped behaviour or something they turned on three minutes ago.
 */
export function describeActiveChaos(chaos: ChaosSnapshot): string[] {
  const active: string[] = []

  if (chaos.latencyMs !== DEFAULT_CHAOS_SETTINGS.latencyMs) {
    active.push(`latency ${chaos.latencyMs}`)
  }

  if (chaos.jitterMs !== DEFAULT_CHAOS_SETTINGS.jitterMs) {
    active.push(`jitter ${chaos.jitterMs}`)
  }

  if (chaos.failureRate !== DEFAULT_CHAOS_SETTINGS.failureRate) {
    active.push(`fail ${Math.round(chaos.failureRate * 100)}%`)
  }

  if (chaos.timeoutRate !== DEFAULT_CHAOS_SETTINGS.timeoutRate) {
    active.push(`timeout ${Math.round(chaos.timeoutRate * 100)}%`)
  }

  if (chaos.corruptNextResponse) active.push('corrupt next')

  const renamed = Object.values(chaos.renamedFields).flatMap((fields) => Object.keys(fields)).length
  const retyped = Object.values(chaos.retypedFields).flatMap((fields) => Object.keys(fields)).length

  if (renamed > 0) active.push(`${renamed} renamed`)
  if (retyped > 0) active.push(`${retyped} retyped`)
  if (chaos.droppedDatasets.length > 0) active.push(`${chaos.droppedDatasets.length} dropped`)

  return active
}
