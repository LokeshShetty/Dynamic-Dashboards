import { useEffect, useRef, useState } from 'react'

import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

import { useAppStore } from '@/lib/store'
import type { Toast, ToastTone } from '@/lib/store/slices/toast.slice'
import { cn } from '@/lib/utils'

import { Button } from './button'

const AUTO_DISMISS_MS = 5000

const TONE = {
  success: { icon: CheckCircle2, className: 'border-success bg-success-surface' },
  error: { icon: AlertTriangle, className: 'border-danger bg-danger-surface' },
  info: { icon: Info, className: 'border-border bg-surface-raised' },
} as const

/**
 * Two live regions, both present from the first render so that anything inserted into them is
 * announced: successes go politely, failures interrupt. A toast that is hovered or focused
 * stops counting down, because a message that vanishes while it is being read is no message.
 */
export function ToastRegion() {
  const toasts = useAppStore((state) => state.toasts)

  const errors = toasts.filter((toast) => toast.tone === 'error')
  const rest = toasts.filter((toast) => toast.tone !== 'error')

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2">
      <div aria-live="assertive" aria-atomic="false" className="flex flex-col gap-2">
        {errors.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </div>
      <div aria-live="polite" aria-atomic="false" className="flex flex-col gap-2">
        {rest.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </div>
    </div>
  )
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useAppStore((state) => state.dismissToast)
  const [isPaused, setIsPaused] = useState(false)
  const remainingRef = useRef(AUTO_DISMISS_MS)

  useEffect(() => {
    if (isPaused) return

    const startedAt = Date.now()
    const timer = setTimeout(() => dismissToast(toast.id), remainingRef.current)

    return () => {
      clearTimeout(timer)
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAt))
    }
  }, [dismissToast, isPaused, toast.id])

  const pause = () => setIsPaused(true)
  const resume = () => setIsPaused(false)
  const { icon: Icon, className } = TONE[toast.tone satisfies ToastTone]

  return (
    <div
      className={cn(
        'text-fg pointer-events-auto flex items-start gap-2 rounded-md border p-3 shadow-lg',
        className,
      )}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={resume}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.description === undefined ? null : (
          <p className="text-fg-muted text-xs">{toast.description}</p>
        )}
        {toast.action === undefined ? null : (
          <Button
            size="sm"
            onClick={() => {
              dismissToast(toast.id)
              toast.action?.onAction()
            }}
          >
            {toast.action.label}
          </Button>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Dismiss: ${toast.title}`}
        onClick={() => dismissToast(toast.id)}
      >
        <X aria-hidden="true" className="size-3" />
      </Button>
    </div>
  )
}
