import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Props = {
  columns: number
  children: ReactNode
  className?: string
}

/** The 12 column grid the configuration places widgets on. */
export function WidgetGrid({ columns, children, className }: Props) {
  return (
    <div
      className={cn('grid auto-rows-[minmax(7rem,auto)] gap-3', className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  )
}
