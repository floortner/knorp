import { useMutation } from '@tanstack/react-query';
import { coreApi } from '@/lib/endpoints';

/**
 * Generate a session (POST /sessions). Default is a deterministic bank session; `source:'llm'` requests
 * a generated lecture (teaching intro + fresh exercises — takes a few seconds). The lesson runner
 * consumes the result.
 */
export function useCreateSession() {
  return useMutation({
    mutationFn: ({
      profileId,
      unit,
      source,
      assignmentId,
    }: {
      profileId: string;
      unit?: number;
      source?: 'bank' | 'llm' | 'assigned';
      assignmentId?: string;
    }) => coreApi.createSession(profileId, { unit, source, assignmentId }),
  });
}
