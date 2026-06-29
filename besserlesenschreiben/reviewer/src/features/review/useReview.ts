import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reviewApi } from '@/lib/endpoints';
import type { QueuePage, ReviewSubmitBody } from '@/lib/contract';

/**
 * Source the item to review from the queue cache (the list already carries image + draft). A direct
 * deep-link / refresh has no cached list, so we refetch the queue and pick it out. (If the backend
 * later adds GET /staff/queue/{id}, swap this for a direct fetch.)
 */
export function useQueueItem(uploadId: string) {
  return useQuery({
    queryKey: ['staff-queue'],
    queryFn: () => reviewApi.queue({ limit: 50 }),
    select: (page: QueuePage) => page.items.find((i) => i.uploadId === uploadId) ?? null,
  });
}

/** Soft-lock the item on entering the review screen so two reviewers don't grade it twice. */
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
