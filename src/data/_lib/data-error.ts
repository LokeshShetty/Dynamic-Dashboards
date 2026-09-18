import type { DataError } from '../_types'

/**
 * TanStack Query decides what to retry from a rejected promise, so the client throws at that
 * one boundary. The typed error travels on the class; nothing reads the message to decide.
 */
export class DataRequestError extends Error {
  readonly detail: DataError

  constructor(detail: DataError) {
    super(describeDataError(detail))
    this.name = 'DataRequestError'
    this.detail = detail
  }
}

export function toDataError(error: unknown): DataError {
  if (error instanceof DataRequestError) return error.detail
  if (error instanceof Error) return { kind: 'request-failed', message: error.message }
  return { kind: 'request-failed', message: 'the request failed for an unknown reason' }
}

/** Waiting cannot bring back a field that was renamed, so only transport failures retry. */
export function isRetryableDataError(error: DataError) {
  return error.kind === 'request-failed' || error.kind === 'timeout'
}

/** A binding failure means the configuration no longer describes the world it points at. */
export function isBindingDataError(error: DataError) {
  return (
    error.kind === 'unknown-dataset' ||
    error.kind === 'unknown-field' ||
    error.kind === 'field-type'
  )
}

export function describeDataError(error: DataError): string {
  switch (error.kind) {
    case 'request-failed':
      return error.message
    case 'timeout':
      return `the data source did not answer within ${error.timeoutMs / 1000} seconds`
    case 'aborted':
      return 'the request was cancelled'
    case 'corrupt-response':
      return `the data source answered with something unreadable: ${error.message}`
    case 'unknown-dataset':
      return `dataset "${error.dataset}" does not exist`
    case 'unknown-field':
      return `field "${error.field}" does not exist in ${error.dataset}`
    case 'field-type':
      return `field "${error.field}" is ${error.actual}, and this needs ${error.expected}`
  }
}
