import { useQuery } from '@tanstack/react-query';
import { fetchHealth, healthQueryKey } from './api';

/**
 * Data fetching lives in a hook, not in the component. Components render.
 */
export function useHealth() {
  return useQuery({
    queryKey: healthQueryKey,
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    retry: 1,
  });
}
