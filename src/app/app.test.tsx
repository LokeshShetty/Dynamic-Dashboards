import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './app'

describe('App', () => {
  it('mounts the providers and lands on the dashboard route', async () => {
    window.history.replaceState({}, '', '/d/demo')
    render(<App />)
    expect(await screen.findByText(/Configurable dashboard/i)).toBeInTheDocument()
    expect(await screen.findByText('demo')).toBeInTheDocument()
  })
})
