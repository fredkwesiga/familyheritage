import { QueryClient } from '@tanstack/react-query';

/**
 * Defaults tuned for a low-bandwidth audience: don't refetch on every window
 * focus, keep data fresh for a minute, retry once. Family data changes slowly.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
