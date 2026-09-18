import { z } from 'zod'

import { log } from '@/lib/log'
import type { ChaosSettings } from '@/types/chaos'

import { CHAOS_LIMITS, CHAOS_PARAMS } from '../_constants'

/**
 * Reads chaos settings from the query string, so a reviewer can turn the screws without
 * opening the panel: ?latency=1500&failRate=0.3&timeoutRate=0.1
 *
 * A parameter that does not make sense is ignored and logged, never quietly reinterpreted
 * as something the reviewer did not ask for.
 */
const millisecondsSchema = (max: number) => z.coerce.number().int().min(0).max(max)
const rateSchema = z.coerce.number().min(0).max(1)

function readParam(params: URLSearchParams, name: string, schema: z.ZodType<number>) {
  const raw = params.get(name)
  if (raw === null) return null

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    log.warn('chaos.param.ignored', {
      param: name,
      value: raw,
      reason: parsed.error.issues[0]?.message,
    })
    return null
  }

  return parsed.data
}

export function readChaosSettingsFromSearch(search: string): Partial<ChaosSettings> {
  const params = new URLSearchParams(search)
  const settings: Partial<ChaosSettings> = {}

  const latencyMs = readParam(
    params,
    CHAOS_PARAMS.LATENCY,
    millisecondsSchema(CHAOS_LIMITS.MAX_LATENCY_MS),
  )
  if (latencyMs !== null) settings.latencyMs = latencyMs

  const jitterMs = readParam(
    params,
    CHAOS_PARAMS.JITTER,
    millisecondsSchema(CHAOS_LIMITS.MAX_JITTER_MS),
  )
  if (jitterMs !== null) settings.jitterMs = jitterMs

  const failureRate = readParam(params, CHAOS_PARAMS.FAILURE_RATE, rateSchema)
  if (failureRate !== null) settings.failureRate = failureRate

  const timeoutRate = readParam(params, CHAOS_PARAMS.TIMEOUT_RATE, rateSchema)
  if (timeoutRate !== null) settings.timeoutRate = timeoutRate

  return settings
}
