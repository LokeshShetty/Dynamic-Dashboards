/** Rejection used when a wait is cut short. The caller decides whether that was a timeout. */
export class AbortedError extends Error {
  constructor() {
    super('aborted')
    this.name = 'AbortedError'
  }
}

export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new AbortedError())
      return
    }

    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    function onAbort() {
      clearTimeout(timer)
      reject(new AbortedError())
    }

    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/** A request that never answers. It ends only when the signal says so. */
export function neverSettle(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    if (signal.aborted) {
      reject(new AbortedError())
      return
    }
    signal.addEventListener('abort', () => reject(new AbortedError()), { once: true })
  })
}

export type TimeoutSignal = {
  signal: AbortSignal
  /** True when this controller, rather than the caller, ended the request. */
  timedOut: () => boolean
  dispose: () => void
}

/**
 * One signal that carries both reasons a request can end: the caller cancelled it, or it ran
 * out of time. Both paths abort the same underlying work, which is what makes the timeout real
 * rather than a promise race that leaves the request running.
 */
export function createTimeoutSignal(parent: AbortSignal | undefined, ms: number): TimeoutSignal {
  const controller = new AbortController()
  let timedOut = false

  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, ms)

  const onParentAbort = () => controller.abort()

  if (parent?.aborted) controller.abort()
  else parent?.addEventListener('abort', onParentAbort, { once: true })

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer)
      parent?.removeEventListener('abort', onParentAbort)
    },
  }
}
