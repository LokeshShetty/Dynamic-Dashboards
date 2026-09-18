import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Props = {
  label: string
  controlId: string
  children: ReactNode
  note?: ReactNode
  className?: string
}

export function FilterField({ label, controlId, children, note, className }: Props) {
  return (
    <div className={cn('flex min-w-44 flex-col gap-1', className)}>
      <label htmlFor={controlId} className="text-fg-muted text-xs font-medium">
        {label}
      </label>
      {children}
      {note}
    </div>
  )
}

export const FILTER_CONTROL_CLASS =
  'border-border bg-surface-raised text-fg h-8 w-full rounded-md border px-2 text-xs'

/** The control is a data surface, so it has a loading shape of its own rather than a spinner. */
export function FilterSkeleton() {
  return <div className="bg-surface-muted h-8 w-full animate-pulse rounded-md" />
}

export function FilterNote({ tone, children }: { tone: 'muted' | 'warning'; children: ReactNode }) {
  return (
    <p
      role={tone === 'warning' ? 'status' : undefined}
      className={cn('text-xs', tone === 'warning' ? 'text-warning' : 'text-fg-subtle')}
    >
      {children}
    </p>
  )
}
