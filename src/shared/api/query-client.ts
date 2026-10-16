import { QueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (count, error) =>
        count < 1 &&
        !(isAxiosError(error) && (error.response?.status ?? 500) < 500),
    },
    mutations: { retry: false },
  },
})
