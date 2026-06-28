import { useQuery } from '@tanstack/react-query';
import { coreApi } from '@/lib/endpoints';

/** Per-profile progress: streak, stars, weekly activity, monthly heatmap, league, skill breakdown. */
export function useProgress(profileId: string | undefined) {
  return useQuery({
    queryKey: ['progress', profileId],
    queryFn: () => coreApi.progress(profileId as string),
    enabled: Boolean(profileId),
    staleTime: 30_000, // avoid refetching on every tab switch; completing a session invalidates it anyway
  });
}
