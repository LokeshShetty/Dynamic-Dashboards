import { AbortedError, createTimeoutSignal, delay, neverSettle } from '@/lib/abort'
import { log } from '@/lib/log'
import { useAppStore } from '@/lib/store'
import type { ChaosSnapshot } from '@/types/chaos'

import { REQUEST_TIMEOUT_MS } from '../_constants'

export type RequestOptions = { signal?: AbortSignal }

export type TransportFailure =
  | { kind: 'request-failed'; message: string }
  | { kind: 'timeout'; timeoutMs: number }
  | { kind: 'aborted' }

export function readChaos(): ChaosSnapshot {
  return useAppStore.getState()
}

export function takeCorruption() {
  return useAppStore.getState().takeCorruption()
}

/**
 * The conditions every request runs under, whichever source it talks to. Reading a dataset and
 * saving a dashboard are equally slow, equally likely to fail and equally cancellable, because
 * a save that is always instant would hide exactly the states this system exists to handle.
 */
export async function withTransport<T>(
  options: RequestOptions,
  chaos: ChaosSnapshot,
  event: string,
  work: () => T,
  toError: (failure: TransportFailure) => Error,
): Promise<T> {
  const timeout = createTimeoutSignal(options.signal, REQUEST_TIMEOUT_MS)

  try {
    // A request that never answers. The timeout, not a race, is what ends it.
    if (Math.random() < chaos.timeoutRate) {
      await neverSettle(timeout.signal)
    }

    await delay(chaos.latencyMs + Math.random() * chaos.jitterMs, timeout.signal)

    if (Math.random() < chaos.failureRate) {
      throw toError({ kind: 'request-failed', message: 'the request was refused' })
    }

    return work()
  } catch (error) {
    if (error instanceof AbortedError) {
      if (timeout.timedOut()) {
        log.warn(`${event}.timeout`, { timeoutMs: REQUEST_TIMEOUT_MS })
        throw toError({ kind: 'timeout', timeoutMs: REQUEST_TIMEOUT_MS })
      }

      throw toError({ kind: 'aborted' })
    }

    throw error
  } finally {
    timeout.dispose()
  }
}
