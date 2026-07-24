import { useQuery } from '@tanstack/react-query';
import { staffAuthApi } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';

/** Probe the staff session. A 401 means "not logged in" — don't retry it as a transient error. */
export function useStaffMe() {
  return useQuery({
    queryKey: ['staff-me'],
    queryFn: () => staffAuthApi.me(),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) return false;
      return failureCount < 1;
    },
    staleTime: 5 * 60 * 1000,
  });
}
