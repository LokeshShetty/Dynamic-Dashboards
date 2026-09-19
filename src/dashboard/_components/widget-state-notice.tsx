import { cva } from 'class-variance-authority'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { ConfigIssue } from '../_types'

type Props = {
  tone: 'neutral' | 'warning' | 'danger'
  message: string
  issues?: ConfigIssue[]
  retry?: { label: string; onRetry: () => void }
  className?: string
}

const noticeVariants = cva('flex flex-col items-start gap-2 rounded-md border p-3', {
  variants: {
    tone: {
      neutral: 'border-border bg-surface-muted',
      warning: 'border-warning bg-warning-surface',
      danger: 'border-danger bg-danger-surface',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

/**
 * The words under a failed state. They name the field, the dataset or the widget that caused
 * it, because "something went wrong" is indistinguishable from a lie to the person reading it.
 */
export function WidgetStateNotice({ tone, message, issues, retry, className }: Props) {
  return (
    <div
      role={tone === 'neutral' ? undefined : 'alert'}
      className={cn(noticeVariants({ tone }), className)}
    >
      <p className="text-fg text-sm">{message}</p>

      {issues && issues.length > 0 ? (
        <ul className="text-fg-muted flex flex-col gap-0.5 text-xs">
          {issues.slice(0, 4).map((issue) => (
            <li key={`${issue.path}:${issue.message}`}>
              <code className="text-fg">{issue.path === '' ? 'configuration' : issue.path}</code>{' '}
              {issue.message}
            </li>
          ))}
          {issues.length > 4 ? <li>and {issues.length - 4} more</li> : null}
        </ul>
      ) : null}

      {retry ? (
        <Button size="sm" onClick={retry.onRetry}>
          {retry.label}
        </Button>
      ) : null}
    </div>
  )
}
