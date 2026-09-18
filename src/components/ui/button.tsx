import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md border font-medium transition-colors disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        solid: 'bg-accent text-accent-fg border-transparent hover:opacity-90',
        outline: 'bg-surface-raised text-fg border-border hover:bg-surface-muted',
        ghost: 'bg-transparent text-fg-muted border-transparent hover:bg-surface-muted',
        danger: 'bg-danger text-accent-fg border-transparent hover:opacity-90',
      },
      size: {
        sm: 'h-7 px-2 text-xs',
        md: 'h-9 px-3 text-sm',
      },
    },
    defaultVariants: { variant: 'outline', size: 'md' },
  },
)

type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    children: ReactNode
    className?: string
  }

export function Button({ className, variant, size, type = 'button', children, ...props }: Props) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </button>
  )
}
