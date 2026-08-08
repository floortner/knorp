import { useQuery } from '@tanstack/react-query';
import { staffAuthApi } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';

/**
 * Probe the staff session. A 401 is NOT an error here — it resolves to `null` ("anonymous"), so the
 * query settles into data the auth provider can reason about. This also means the global 401 handler
 * (ApiErrorBridge) can flip auth to anon via `setQueryData(['staff-me'], null)` — observers are
 * notified in place. Never `removeQueries` this key: removing it under the mounted observer detaches
 * the hook from the cache, `login()`'s invalidate then finds nothing to refetch, and the portal
 * hangs on "Lädt …" after login (the 2026-08-06 regression).
 */
export function useStaffMe() {
  return useQuery({
    queryKey: ['staff-me'],
    queryFn: async () => {
      try {
        return await staffAuthApi.me();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null; // logged out, not broken
        throw error;
      }
    },
    retry: 1, // 401 no longer reaches retry; give transient failures one more shot
    staleTime: 5 * 60 * 1000,
  });
}
