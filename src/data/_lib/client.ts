import { AbortedError, createTimeoutSignal, delay, neverSettle } from '@/lib/abort'
import { log } from '@/lib/log'
import { useAppStore } from '@/lib/store'
import type { ChaosSnapshot } from '@/types/chaos'
import type { DatasetSchema } from '@/types/data'

import { REQUEST_TIMEOUT_MS } from '../_constants'
import type { DataError, DataQuery, DataResult } from '../_types'
import { corruptDataResult, corruptDatasetSchema } from './corrupt'
import { DataRequestError } from './data-error'
import { readEffectiveDataset } from './effective-dataset'
import { executeQuery } from './execute-query'
import { dataResultResponseSchema, datasetSchemaResponseSchema } from './response.schema'
import { worldDatasetIds } from './world'

/**
 * The fake data source. It is asynchronous, slow on purpose, fails on purpose, and every
 * request honours its AbortSignal, because the guarantee that an abandoned request cannot
 * land on screen is only worth as much as the cancellation underneath it.
 */
export type RequestOptions = { signal?: AbortSignal }

export async function fetchDatasetIds(options: RequestOptions = {}): Promise<string[]> {
  const chaos = readChaos()
  return withTransport(options, chaos, 'data.datasets', () =>
    worldDatasetIds().filter((id) => !chaos.droppedDatasets.includes(id)),
  )
}

export async function fetchDatasetSchema(
  dataset: string,
  options: RequestOptions = {},
): Promise<DatasetSchema> {
  const chaos = readChaos()

  return withTransport(options, chaos, 'data.schema', () => {
    const effective = readEffectiveDataset(dataset, chaos)
    if (!effective.ok) throw new DataRequestError(effective.error)

    const payload = takeCorruption()
      ? corruptDatasetSchema(effective.data.schema)
      : effective.data.schema

    return validate(datasetSchemaResponseSchema.safeParse(payload))
  })
}

export async function runDataQuery(
  query: DataQuery,
  options: RequestOptions = {},
): Promise<DataResult> {
  const chaos = readChaos()

  return withTransport(options, chaos, 'data.query', () => {
    const effective = readEffectiveDataset(query.dataset, chaos)
    if (!effective.ok) throw new DataRequestError(effective.error)

    const result = executeQuery(query, effective.data)
    if (!result.ok) throw new DataRequestError(result.error)

    const payload = takeCorruption() ? corruptDataResult(result.data) : result.data

    return validate(dataResultResponseSchema.safeParse(payload))
  })
}

function readChaos(): ChaosSnapshot {
  return useAppStore.getState()
}

function takeCorruption() {
  return useAppStore.getState().takeCorruption()
}

function validate<T>(parsed: { success: true; data: T } | { success: false; error: unknown }): T {
  if (parsed.success) return parsed.data

  const message =
    parsed.error instanceof Error ? parsed.error.message : 'the payload did not match its schema'

  throw new DataRequestError({ kind: 'corrupt-response', message })
}

/**
 * Everything every request shares: the wait, the dice, the timeout and the cancellation.
 * The work itself is a synchronous function, so the transport story stays in one place.
 */
async function withTransport<T>(
  options: RequestOptions,
  chaos: ChaosSnapshot,
  event: string,
  work: () => T,
): Promise<T> {
  const timeout = createTimeoutSignal(options.signal, REQUEST_TIMEOUT_MS)

  try {
    // A request that never answers. The timeout, not a race, is what ends it.
    if (Math.random() < chaos.timeoutRate) {
      await neverSettle(timeout.signal)
    }

    await delay(chaos.latencyMs + Math.random() * chaos.jitterMs, timeout.signal)

    if (Math.random() < chaos.failureRate) {
      throw new DataRequestError({
        kind: 'request-failed',
        message: 'the data source refused the request',
      })
    }

    return work()
  } catch (error) {
    throw toThrownError(error, event, timeout.timedOut())
  } finally {
    timeout.dispose()
  }
}

function toThrownError(error: unknown, event: string, timedOut: boolean): DataRequestError {
  if (error instanceof AbortedError) {
    const detail: DataError = timedOut
      ? { kind: 'timeout', timeoutMs: REQUEST_TIMEOUT_MS }
      : { kind: 'aborted' }

    if (timedOut) log.warn(`${event}.timeout`, { timeoutMs: REQUEST_TIMEOUT_MS })
    return new DataRequestError(detail)
  }

  if (error instanceof DataRequestError) {
    log.warn(`${event}.failed`, { kind: error.detail.kind })
    return error
  }

  return new DataRequestError({
    kind: 'request-failed',
    message: error instanceof Error ? error.message : 'the request failed',
  })
}
