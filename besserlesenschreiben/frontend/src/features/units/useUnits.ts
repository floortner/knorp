import { useQuery } from '@tanstack/react-query';
import { coreApi } from '@/lib/endpoints';

/** Unit catalogue with per-profile status + live item counts (GET /units). */
export function useUnits(profileId: string | undefined) {
  return useQuery({
    queryKey: ['units', profileId],
    queryFn: () => coreApi.units(profileId as string),
    enabled: Boolean(profileId),
  });
}
