import { createBrowserRouter, Navigate } from 'react-router'

import { DashboardRoute } from '@/dashboard/dashboard-route'

import { RootLayout } from './root-layout'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <Navigate to="/d/demo" replace /> },
      { path: 'd/:id', element: <DashboardRoute /> },
    ],
  },
])
