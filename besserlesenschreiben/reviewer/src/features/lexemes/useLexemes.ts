import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lexemesApi, type LexemeFilters } from '@/lib/endpoints';
import type { LexemeCreateBody, LexemeEditBody } from '@/lib/contract';

/** Filtered, searchable word list (admin only; backend SPEC §6). `enabled` skips it for non-admins. */
export function useLexemes(filters: LexemeFilters, enabled = true) {
  return useQuery({
    queryKey: ['staff-lexemes', filters],
    // No practical cap — the curation table shows the whole filtered pool (backend MAX_LIMIT guards it).
    queryFn: () => lexemesApi.list({ ...filters, limit: 5000 }),
    enabled,
  });
}

/** Aggregate stats over the same filter (total + breakdowns). */
export function useLexemeStats(filters: LexemeFilters, enabled = true) {
  return useQuery({
    queryKey: ['staff-lexeme-stats', filters],
    queryFn: () => lexemesApi.stats(filters),
    enabled,
  });
}

/** edit / add / delete / export — each list mutation refreshes the word list AND the stats. */
export function useLexemeActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['staff-lexemes'] });
    qc.invalidateQueries({ queryKey: ['staff-lexeme-stats'] });
  };

  const edit = useMutation({
    mutationFn: ({ lemma, body }: { lemma: string; body: LexemeEditBody }) => lexemesApi.edit(lemma, body),
    onSuccess: invalidate,
  });
  const add = useMutation({ mutationFn: (body: LexemeCreateBody) => lexemesApi.add(body), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (lemma: string) => lexemesApi.remove(lemma), onSuccess: invalidate });
  const exportOverrides = useMutation({ mutationFn: () => lexemesApi.export() });

  return { edit, add, remove, exportOverrides };
}
