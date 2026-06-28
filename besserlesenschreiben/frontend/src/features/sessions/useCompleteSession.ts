import { useMutation, useQueryClient } from '@tanstack/react-query';
import { coreApi } from '@/lib/endpoints';

/** Complete a session (POST /sessions/:id/complete) and refresh progress + units (SPEC §7). */
export function useCompleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => coreApi.completeSession(sessionId),
    onSuccess: () => {
      // Completing a session moves stars/streak (shown on Profil via /me), progress stats, and unit
      // unlock state — refresh all three. ['progress'] is a prefix that matches ['progress', profileId].
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['progress'] });
      void qc.invalidateQueries({ queryKey: ['units'] });
    },
  });
}
