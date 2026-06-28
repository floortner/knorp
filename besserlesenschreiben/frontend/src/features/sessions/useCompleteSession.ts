import { useMutation, useQueryClient } from '@tanstack/react-query';
import { coreApi } from '@/lib/endpoints';

/** Complete a session (POST /sessions/:id/complete) and refresh progress + units (SPEC §7). */
export function useCompleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => coreApi.completeSession(sessionId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['progress'] });
      void qc.invalidateQueries({ queryKey: ['units'] });
    },
  });
}
