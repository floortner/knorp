import { useQuery } from '@tanstack/react-query';
import { coreApi } from '@/lib/endpoints';
import type { Profile } from '@/lib/types';

/** The authenticated household (account + student profiles). Drives the cookie-session auth probe;
 *  no retry so an anon 401 resolves to "not authenticated" promptly. */
export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: coreApi.me, retry: false, staleTime: 60_000 });
}

/**
 * The active student profile. One student per device is the common case, so we use the first profile.
 * `undefined` while loading or when the account has no profile yet (→ onboarding, milestone 2).
 */
export function useActiveProfile(): Profile | undefined {
  const { data } = useMe();
  return data?.profiles[0];
}
