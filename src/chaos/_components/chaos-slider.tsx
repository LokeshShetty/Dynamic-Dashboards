import { useId } from 'react'

import { cn } from '@/lib/utils'

type Props = {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (value: number) => string
  onChange: (value: number) => void
  className?: string
}

export function ChaosSlider({ label, value, min, max, step, format, onChange, className }: Props) {
  const id = useId()

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-fg-muted text-xs font-medium">
          {label}
        </label>
        <span className="text-fg font-mono text-xs">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-accent h-1 w-full"
      />
    </div>
  )
}
