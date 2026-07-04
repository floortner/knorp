import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lexemesApi } from '@/lib/endpoints';
import type { LexemeCreateBody, LexemeEditBody } from '@/lib/contract';

/** Searchable, skill-filterable word list (admin only; backend SPEC §6). `enabled` skips it for non-admins. */
export function useLexemes(params: { search?: string; skill?: string }, enabled = true) {
  return useQuery({
    queryKey: ['staff-lexemes', params.search ?? '', params.skill ?? ''],
    queryFn: () => lexemesApi.list({ ...params, limit: 100 }),
    enabled,
  });
}

/** edit / add / delete / export — each list mutation refreshes the word list after it lands. */
export function useLexemeActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['staff-lexemes'] });

  const edit = useMutation({
    mutationFn: ({ lemma, body }: { lemma: string; body: LexemeEditBody }) => lexemesApi.edit(lemma, body),
    onSuccess: invalidate,
  });
  const add = useMutation({ mutationFn: (body: LexemeCreateBody) => lexemesApi.add(body), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (lemma: string) => lexemesApi.remove(lemma), onSuccess: invalidate });
  const exportOverrides = useMutation({ mutationFn: () => lexemesApi.export() });

  return { edit, add, remove, exportOverrides };
}
