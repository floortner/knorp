import { useMutation } from '@tanstack/react-query';
import { coreApi } from '@/lib/endpoints';

/** Generate a bank session for a unit (POST /sessions). The lesson runner consumes the result (M5). */
export function useCreateSession() {
  return useMutation({
    mutationFn: ({ profileId, unit }: { profileId: string; unit?: number }) =>
      coreApi.createSession(profileId, unit),
  });
}
