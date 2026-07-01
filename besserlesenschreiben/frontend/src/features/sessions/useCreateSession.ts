import { useMutation } from '@tanstack/react-query';
import { coreApi } from '@/lib/endpoints';

/**
 * Generate a session (POST /sessions). Default is a deterministic bank session; `source:'llm'` requests
 * a generated lecture (teaching intro + fresh exercises — takes a few seconds). The lesson runner
 * consumes the result.
 */
export function useCreateSession() {
  return useMutation({
    mutationFn: ({ profileId, unit, source }: { profileId: string; unit?: number; source?: 'bank' | 'llm' }) =>
      coreApi.createSession(profileId, unit, source),
  });
}
