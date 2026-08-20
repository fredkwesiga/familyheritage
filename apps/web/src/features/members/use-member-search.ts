import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { memberSearchResponseSchema, MIN_SEARCH_LENGTH } from '@fh/shared';
import { apiRequest } from '@/lib/api-client';

/**
 * Waits until typing pauses.
 *
 * 250 ms is long enough that a name is typed as one request rather than eight,
 * and short enough that it still feels immediate. It matters more here than it
 * would elsewhere: the query behind this does trigram comparisons across the
 * family, and firing it per keystroke on a free-tier instance is wasteful for
 * no gain.
 */
function useDebounced(value: string, delay = 250): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function useMemberSearch(familyId: string, rawQuery: string) {
  const query = useDebounced(rawQuery.trim());
  const enabled = query.length >= MIN_SEARCH_LENGTH;

  const result = useQuery({
    queryKey: ['families', familyId, 'members', 'search', query],
    queryFn: () =>
      apiRequest(
        `/families/${familyId}/members/search?q=${encodeURIComponent(query)}`,
        memberSearchResponseSchema,
      ),
    enabled,
    // Names change rarely; re-running the same search within a session is waste.
    staleTime: 60_000,
  });

  return {
    ...result,
    /** True while the debounce is still pending, so the UI can stay quiet. */
    isTyping: rawQuery.trim() !== query,
    enabled,
  };
}