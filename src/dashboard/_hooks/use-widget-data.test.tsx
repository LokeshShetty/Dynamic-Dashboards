import type { ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EMPTY_CHAOS_MUTATIONS } from '@/chaos/_constants'
import { readEffectiveDataset } from '@/data/_lib/effective-dataset'
import { executeQuery } from '@/data/_lib/execute-query'
import type { DataQuery } from '@/data/_types'
import { useAppStore } from '@/lib/store'

import { useWidgetData } from './use-widget-data'

const DASHBOARD_ID = 'demo'
const WIDGET_ID = 'claims-count'

function queryForStatus(status: string): DataQuery {
  return {
    dataset: 'claims',
    filters: [{ kind: 'equals', field: 'status', value: status }],
    select: { kind: 'aggregate', field: 'claim_id', aggregate: 'count' },
  }
}

/** The answer the world would give, computed without the transport in the way. */
function trueAnswer(query: DataQuery) {
  const dataset = readEffectiveDataset('claims', EMPTY_CHAOS_MUTATIONS)
  if (!dataset.ok) throw new Error('claims dataset is missing')

  const result = executeQuery(query, dataset.data)
  if (!result.ok) throw new Error('query did not execute')
  if (result.data.kind !== 'value') throw new Error('expected an aggregate result')

  return result.data.value
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Number.POSITIVE_INFINITY, staleTime: Number.POSITIVE_INFINITY },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('useWidgetData', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    act(() => {
      useAppStore.getState().reset()
      useAppStore.getState().setSettings({ jitterMs: 0, failureRate: 0, timeoutRate: 0 })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the answer to the question being asked, even when an older answer arrives later', async () => {
    const slowQuery = queryForStatus('paid')
    const fastQuery = queryForStatus('denied')

    expect(trueAnswer(slowQuery)).not.toBe(trueAnswer(fastQuery))

    act(() => {
      useAppStore.getState().setSettings({ latencyMs: 5000 })
    })

    // Two observers on the same widget: one follows the filter, one stays on the slow
    // question so that its answer really does arrive, late, rather than being cancelled.
    const { result, rerender } = renderHook(
      ({ query }: { query: DataQuery }) => ({
        followsFilter: useWidgetData({ dashboardId: DASHBOARD_ID, widgetId: WIDGET_ID, query })
          .state,
        staysOnSlowQuery: useWidgetData({
          dashboardId: DASHBOARD_ID,
          widgetId: WIDGET_ID,
          query: slowQuery,
        }).state,
      }),
      { initialProps: { query: slowQuery }, wrapper: createWrapper() },
    )

    expect(result.current.followsFilter.kind).toBe('loading')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(result.current.followsFilter.kind).toBe('loading')

    // The filter changes, and the world gets quicker, so the new question answers first.
    act(() => {
      useAppStore.getState().setSettings({ latencyMs: 100 })
    })
    rerender({ query: fastQuery })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })

    const afterFastAnswer = result.current.followsFilter
    expect(afterFastAnswer.kind).toBe('ok')
    if (afterFastAnswer.kind !== 'ok' || afterFastAnswer.result.kind !== 'value') return
    expect(afterFastAnswer.result.value).toBe(trueAnswer(fastQuery))

    // Now the slow answer to the old question lands.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    const slowLanded = result.current.staysOnSlowQuery
    expect(slowLanded.kind).toBe('ok')
    if (slowLanded.kind !== 'ok' || slowLanded.result.kind !== 'value') return
    expect(slowLanded.result.value).toBe(trueAnswer(slowQuery))

    // The screen still shows the answer to the question that is actually being asked.
    const stillShown = result.current.followsFilter
    expect(stillShown.kind).toBe('ok')
    if (stillShown.kind !== 'ok' || stillShown.result.kind !== 'value') return
    expect(stillShown.result.value).toBe(trueAnswer(fastQuery))
  })
})
