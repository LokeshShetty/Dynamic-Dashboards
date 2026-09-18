import { log } from '@/lib/log'
import type { ChaosSnapshot } from '@/types/chaos'
import type { DatasetSchema } from '@/types/data'

import { DISTINCT_VALUE_LIMIT } from '../_constants'
import type { DataQuery, DataResult, DistinctValues } from '../_types'
import { corruptDataResult, corruptDatasetSchema } from './corrupt'
import { DataRequestError } from './data-error'
import { readEffectiveDataset } from './effective-dataset'
import { distinctValues, executeQuery } from './execute-query'
import {
  dataResultResponseSchema,
  datasetSchemaResponseSchema,
  distinctValuesResponseSchema,
} from './response.schema'
import {
  readChaos,
  withTransport as runTransport,
  takeCorruption,
  type RequestOptions,
} from './transport'
import { worldDatasetIds } from './world'

/**
 * The fake data source. It is asynchronous, slow on purpose, fails on purpose, and every
 * request honours its AbortSignal, because the guarantee that an abandoned request cannot
 * land on screen is only worth as much as the cancellation underneath it.
 */
export type { RequestOptions }

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

/**
 * The values a filter control can offer. It is a request like any other, so the filter bar is
 * as slow, as failure prone and as affected by a renamed field as the widgets underneath it.
 */
export async function fetchDistinctValues(
  dataset: string,
  field: string,
  options: RequestOptions = {},
): Promise<DistinctValues> {
  const chaos = readChaos()

  return withTransport(options, chaos, 'data.distinct', () => {
    const effective = readEffectiveDataset(dataset, chaos)
    if (!effective.ok) throw new DataRequestError(effective.error)

    const found = distinctValues(effective.data, field, DISTINCT_VALUE_LIMIT)
    if (!found.ok) throw new DataRequestError(found.error)

    const payload = takeCorruption()
      ? { dataset, field, values: [null], truncated: 'maybe' }
      : { dataset, field, ...found.data }

    return validate(distinctValuesResponseSchema.safeParse(payload))
  })
}

function validate<T>(parsed: { success: true; data: T } | { success: false; error: unknown }): T {
  if (parsed.success) return parsed.data

  const message =
    parsed.error instanceof Error ? parsed.error.message : 'the payload did not match its schema'

  throw new DataRequestError({ kind: 'corrupt-response', message })
}

/** The dataset client's own wrapper: shared transport, with data layer errors on top. */
async function withTransport<T>(
  options: RequestOptions,
  chaos: ChaosSnapshot,
  event: string,
  work: () => T,
): Promise<T> {
  try {
    return await runTransport(
      options,
      chaos,
      event,
      work,
      (failure) => new DataRequestError(failure),
    )
  } catch (error) {
    if (error instanceof DataRequestError) {
      if (error.detail.kind !== 'aborted') log.warn(`${event}.failed`, { kind: error.detail.kind })
      throw error
    }

    throw new DataRequestError({
      kind: 'request-failed',
      message: error instanceof Error ? error.message : 'the request failed',
    })
  }
}
