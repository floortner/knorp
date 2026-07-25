import { useQuery } from '@tanstack/react-query';
import { coreApi } from '@/lib/endpoints';

/**
 * Open staff-assigned lectures for the /lernen card (ROADMAP §H1). An assignment is an offer the
 * student may take up — the card simply disappears once played to completion (no badges, no nagging).
 */
export function useAssignments(profileId: string | undefined) {
  return useQuery({
    queryKey: ['assignments', profileId],
    queryFn: () => coreApi.assignments(profileId!),
    enabled: Boolean(profileId),
  });
}
