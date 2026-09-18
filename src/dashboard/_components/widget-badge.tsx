import { cva, type VariantProps } from 'class-variance-authority'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-surface-muted text-fg-muted',
        warning: 'border-warning bg-warning-surface text-fg',
        danger: 'border-danger bg-danger-surface text-fg',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

type Props = VariantProps<typeof badgeVariants> & {
  icon: LucideIcon
  children: string
  className?: string
}

/** Colour never carries the meaning on its own: every badge has an icon and words. */
export function WidgetBadge({ icon: Icon, tone, children, className }: Props) {
  return (
    <span className={cn(badgeVariants({ tone }), className)}>
      <Icon aria-hidden="true" className="size-3 shrink-0" />
      {children}
    </span>
  )
}
