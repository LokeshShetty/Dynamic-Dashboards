import { useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'
import { DatabaseBackup, FlaskConical, RotateCcw, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { dashboardStore } from '@/storage/_lib/dashboard-store'
import { describeStorageFailure, toStorageFailure } from '@/storage/_lib/storage-error'

import { CHAOS_LIMITS } from '../_constants'
import { ChaosSlider } from './chaos-slider'
import { ChaosWorldControls } from './chaos-world-controls'

const percent = (value: number) => `${Math.round(value * 100)}%`
const milliseconds = (value: number) => `${value} ms`

/**
 * The conditions panel. Everything here is also reachable from the query string and from
 * window.__chaos, so a reviewer can break things from wherever they happen to be.
 */
export function ChaosPanel({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false)

  const latencyMs = useAppStore((state) => state.latencyMs)
  const jitterMs = useAppStore((state) => state.jitterMs)
  const failureRate = useAppStore((state) => state.failureRate)
  const timeoutRate = useAppStore((state) => state.timeoutRate)
  const corruptNextResponse = useAppStore((state) => state.corruptNextResponse)
  const epoch = useAppStore((state) => state.epoch)
  const setSettings = useAppStore((state) => state.setSettings)
  const restoreWorld = useAppStore((state) => state.restoreWorld)
  const reset = useAppStore((state) => state.reset)
  const pushToast = useAppStore((state) => state.pushToast)
  const discardDraft = useAppStore((state) => state.discardDraft)
  const queryClient = useQueryClient()
  const [isReseeding, setIsReseeding] = useState(false)

  const resetToSeed = async () => {
    setIsReseeding(true)

    try {
      await dashboardStore.resetToSeed()
      discardDraft()
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      pushToast({
        tone: 'success',
        title: 'Dashboards reset',
        description: 'The shipped demo and the two legacy configurations are back.',
      })
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Reset failed',
        description: describeStorageFailure(toStorageFailure(error)),
      })
    } finally {
      setIsReseeding(false)
    }
  }

  if (!isOpen) {
    return (
      <Button
        variant="solid"
        className={cn('fixed right-4 bottom-4 shadow-lg', className)}
        aria-expanded={false}
        onClick={() => setIsOpen(true)}
      >
        <FlaskConical aria-hidden="true" className="size-4" />
        Chaos
      </Button>
    )
  }

  return (
    <section
      aria-label="Chaos controls"
      className={cn(
        'border-border bg-surface-raised fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-3 rounded-lg border p-3 shadow-xl',
        className,
      )}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-fg flex items-center gap-2 text-sm font-semibold">
          <FlaskConical aria-hidden="true" className="size-4" />
          Chaos
        </h2>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Close chaos controls"
          onClick={() => setIsOpen(false)}
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </header>

      <ChaosSlider
        label="Latency"
        value={latencyMs}
        min={0}
        max={CHAOS_LIMITS.MAX_LATENCY_MS}
        step={100}
        format={milliseconds}
        onChange={(value) => setSettings({ latencyMs: value })}
      />

      <ChaosSlider
        label="Jitter"
        value={jitterMs}
        min={0}
        max={CHAOS_LIMITS.MAX_JITTER_MS}
        step={100}
        format={milliseconds}
        onChange={(value) => setSettings({ jitterMs: value })}
      />

      <ChaosSlider
        label="Failure rate"
        value={failureRate}
        min={0}
        max={1}
        step={0.05}
        format={percent}
        onChange={(value) => setSettings({ failureRate: value })}
      />

      <ChaosSlider
        label="Timeout rate"
        value={timeoutRate}
        min={0}
        max={1}
        step={0.05}
        format={percent}
        onChange={(value) => setSettings({ timeoutRate: value })}
      />

      <div className="border-border flex flex-col gap-2 border-t pt-3">
        <Button
          size="sm"
          variant={corruptNextResponse ? 'danger' : 'outline'}
          onClick={() => setSettings({ corruptNextResponse: !corruptNextResponse })}
        >
          {corruptNextResponse ? 'Corruption armed for next response' : 'Corrupt next response'}
        </Button>

        <ChaosWorldControls />

        <Button size="sm" disabled={isReseeding} onClick={() => void resetToSeed()}>
          <DatabaseBackup aria-hidden="true" className="size-3" />
          {isReseeding ? 'Resetting stored dashboards…' : 'Reset stored dashboards to seed'}
        </Button>

        <div className="flex items-center justify-between gap-2">
          <span className="text-fg-subtle font-mono text-xs">epoch {epoch}</span>
          <div className="flex gap-1">
            <Button size="sm" onClick={restoreWorld}>
              Restore world
            </Button>
            <Button size="sm" onClick={reset}>
              <RotateCcw aria-hidden="true" className="size-3" />
              Reset
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
