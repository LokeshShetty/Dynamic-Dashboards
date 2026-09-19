import { useEffect, useState } from 'react'

/**
 * A value that lags behind the one being typed. The input stays responsive while whatever the
 * value drives, filtering a long list or asking the data layer a question, waits for a pause.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    if (settled === value) return

    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [delayMs, settled, value])

  return settled
}
