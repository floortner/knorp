import { useMutation, useQueryClient } from '@tanstack/react-query';
import { coreApi } from '@/lib/endpoints';
import type { UpdateSettingsBody } from '@/lib/types';

/**
 * Update a child's settings (PATCH /profiles/:id/settings) and refresh ['me'] so the a11y runtime
 * (A11yProvider) and the rest of the app pick up the change immediately.
 */
export function useUpdateSettings(profileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateSettingsBody) => coreApi.updateSettings(profileId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}
