import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Props = {
  label: string
  controlId: string
  error?: string
  hint?: string
  children: ReactNode
  className?: string
}

export function FormRow({ label, controlId, error, hint, children, className }: Props) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={controlId} className="text-fg-muted text-xs font-medium">
        {label}
      </label>
      {children}
      {hint === undefined ? null : <p className="text-fg-subtle text-xs">{hint}</p>}
      {error === undefined ? null : (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  )
}
