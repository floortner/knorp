import { useMutation, useQueryClient } from '@tanstack/react-query';
import { coreApi, type CreateProfileBody } from '@/lib/endpoints';

/** Create the child profile (POST /profiles) and refresh ['me'] so the app picks it up. */
export function useCreateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProfileBody) => coreApi.createProfile(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}
