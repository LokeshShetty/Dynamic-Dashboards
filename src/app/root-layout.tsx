import { NuqsAdapter } from 'nuqs/adapters/react-router/v8'
import { Outlet } from 'react-router'

/** Holds the providers that need to sit inside the router context. */
export function RootLayout() {
  return (
    <NuqsAdapter>
      <Outlet />
    </NuqsAdapter>
  )
}
