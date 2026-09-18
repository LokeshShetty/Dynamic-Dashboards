import { QueryClient } from '@tanstack/react-query'

/**
 * Retries are deliberate: the fake data layer fails often, and a widget must not
 * report an error the user could have avoided by waiting one more attempt.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: 400,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  },
})
