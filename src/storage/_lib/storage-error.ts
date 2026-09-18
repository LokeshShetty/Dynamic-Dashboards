import type { TransportFailure } from '@/data/_lib/transport'

import type { StorageFailure } from '../_types'

/** Storage throws at the query boundary for the same reason the data client does. */
export class StorageRequestError extends Error {
  readonly detail: StorageFailure

  constructor(detail: StorageFailure) {
    super(describeStorageFailure(detail))
    this.name = 'StorageRequestError'
    this.detail = detail
  }
}

export function toStorageFailure(error: unknown): StorageFailure {
  if (error instanceof StorageRequestError) return error.detail
  if (error instanceof Error) return { kind: 'request-failed', message: error.message }
  return { kind: 'request-failed', message: 'the request failed for an unknown reason' }
}

export function fromTransportFailure(failure: TransportFailure): StorageRequestError {
  return new StorageRequestError(failure)
}

export function isRetryableStorageFailure(failure: StorageFailure) {
  return failure.kind === 'request-failed' || failure.kind === 'timeout'
}

export function describeStorageFailure(failure: StorageFailure): string {
  switch (failure.kind) {
    case 'unavailable':
      return `this browser will not let the dashboard store anything: ${failure.message}`
    case 'quota-exceeded':
      return `there is no room left in storage: ${failure.message}`
    case 'corrupt':
      return `the stored dashboard "${failure.id}" is not readable: ${failure.message}`
    case 'not-found':
      return `there is no dashboard stored under "${failure.id}"`
    case 'request-failed':
      return failure.message
    case 'timeout':
      return `storage did not answer within ${failure.timeoutMs / 1000} seconds`
    case 'aborted':
      return 'the request was cancelled'
  }
}
