import type { ReactNode } from 'react'

import { cva } from 'class-variance-authority'
import type { LucideIcon } from 'lucide-react'

import { BidiText } from '@/components/ui/bidi-text'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { ConfigIssue } from '../_types'
import { WidgetBadge } from './widget-badge'

type Props = {
  tone: 'neutral' | 'warning' | 'danger'
  icon: LucideIcon
  label: string
  message: string
  issues?: ConfigIssue[]
  retry?: { label: string; onRetry: () => void }
  children?: ReactNode
  className?: string
}

const panelVariants = cva(
  'flex min-h-0 flex-1 flex-col items-center justify-center gap-2 overflow-auto rounded-md border border-dashed p-3 text-center',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-surface-muted/60',
        warning: 'border-warning/60 bg-warning-surface/60',
        danger: 'border-danger/60 bg-danger-surface/60',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

const iconVariants = cva('rounded-full p-2', {
  variants: {
    tone: {
      neutral: 'text-fg-subtle bg-surface-muted',
      warning: 'text-warning bg-warning-surface',
      danger: 'text-danger bg-danger-surface',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

/**
 * A widget that cannot show the truth is not a gap in the page. It is the tile doing its job,
 * so it is composed like one: the state, the reason in the reader's words, and a way to act on
 * it, centred in the space the data would have filled.
 */
export function WidgetStatePanel({
  tone,
  icon: Icon,
  label,
  message,
  issues,
  retry,
  children,
  className,
}: Props) {
  return (
    <div
      role={tone === 'neutral' ? undefined : 'alert'}
      className={cn(panelVariants({ tone }), className)}
    >
      <span className={iconVariants({ tone })}>
        <Icon aria-hidden="true" className="size-6" />
      </span>

      <WidgetBadge icon={Icon} tone={tone}>
        {label}
      </WidgetBadge>

      <p className="text-fg max-w-prose text-xs leading-relaxed text-balance">
        <BidiText>{message}</BidiText>
      </p>

      {issues && issues.length > 0 ? (
        <ul className="text-fg-muted flex max-w-prose flex-col gap-0.5 text-xs">
          {issues.slice(0, 3).map((issue) => (
            <li key={`${issue.path}:${issue.message}`}>
              <code className="text-fg">{issue.path === '' ? 'configuration' : issue.path}</code>{' '}
              {issue.message}
            </li>
          ))}
          {issues.length > 3 ? <li>and {issues.length - 3} more</li> : null}
        </ul>
      ) : null}

      {retry ? (
        <Button size="sm" onClick={retry.onRetry}>
          {retry.label}
        </Button>
      ) : null}

      {children}
    </div>
  )
}
