import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reviewApi } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import type { ReviewSubmitBody } from '@/lib/contract';

/**
 * One review item by id — a direct fetch (GET /staff/queue/{uploadId}), so a deep link or refresh
 * resolves no matter how deep the item sits in the paged list. Serves both the review screen (open
 * items) and the history detail (decided items); the screens decide actionability off `decision`.
 * Keyed under the 'staff-queue' prefix so a submitted verdict (which invalidates ['staff-queue'])
 * refreshes it too. A 404 means gone — don't retry it as a transient error.
 */
export function useReviewItem(uploadId: string) {
  return useQuery({
    queryKey: ['staff-queue', 'item', uploadId],
    queryFn: () => reviewApi.item(uploadId),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 1;
    },
  });
}

/** Soft-lock the item on entering the review screen so two trainers don't grade it twice. */
export function useClaim() {
  return useMutation({ mutationFn: (uploadId: string) => reviewApi.claim(uploadId) });
}

/** Submit the authoritative verdict; on success the item leaves the queue. */
export function useSubmitReview(uploadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReviewSubmitBody) => reviewApi.submit(uploadId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff-queue'] });
    },
  });
}
