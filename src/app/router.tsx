import { createBrowserRouter, Navigate } from 'react-router'

import { DashboardRoute } from '@/dashboard/dashboard-route'

import { RootLayout } from './root-layout'
import { RouteErrorScreen } from './route-error-screen'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    // Anything that throws below here lands on a screen with the reason and a way out, rather
    // than on the router's own default.
    errorElement: <RouteErrorScreen />,
    children: [
      { index: true, element: <Navigate to="/d/demo" replace /> },
      { path: 'd/:id', element: <DashboardRoute />, errorElement: <RouteErrorScreen /> },
    ],
  },
])
