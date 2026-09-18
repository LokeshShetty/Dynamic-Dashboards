import { describe, expect, it } from 'vitest'

import { cn } from './utils'

describe('cn', () => {
  it('keeps the last of two conflicting tailwind utilities', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('drops falsy values instead of rendering them', () => {
    expect(cn('text-fg', false, undefined, null, 'font-medium')).toBe('text-fg font-medium')
  })

  it('merges a caller className over the component default', () => {
    expect(cn('bg-surface text-fg-muted', 'text-fg')).toBe('bg-surface text-fg')
  })
})
