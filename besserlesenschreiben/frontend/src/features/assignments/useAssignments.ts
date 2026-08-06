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
    // Overrides the app-wide `refetchOnWindowFocus: false` (main.tsx): a trainer assigns while the
    // student has the app open/backgrounded, and the card should appear when they come back to it —
    // without polling. Focus/visibility is the only extra trigger; there is still no interval.
    refetchOnWindowFocus: true,
  });
}
