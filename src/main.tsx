import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app/app'
import { bootstrapChaos } from '@/chaos/_lib/bootstrap-chaos'

import '@/styles/global.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Cannot mount the app: #root is missing from index.html')
}

bootstrapChaos(window)

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
