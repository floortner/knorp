import { useQuery } from '@tanstack/react-query';
import { reviewApi, type QueueFilter } from '@/lib/endpoints';

export type { QueueFilter };

/** A slice of the review pipeline (first page). Pseudonymised rows; cursor paging is wired in `reviewApi`. */
export function useQueue(status: QueueFilter = 'open') {
  return useQuery({
    queryKey: ['staff-queue', status],
    queryFn: () => reviewApi.queue({ status, limit: 50 }),
    // Small fixed staff pool — a short refetch keeps the shared queue roughly live without polling hard.
    refetchInterval: 30_000,
  });
}

/**
 * Just the count of open requests, for the nav badge. Keyed under the 'staff-queue' prefix, so submitting a
 * review (which invalidates ['staff-queue']) refreshes the badge too.
 */
export function useOpenRequestCount() {
  return useQuery({
    queryKey: ['staff-queue', 'count'],
    queryFn: () => reviewApi.queue({ limit: 1 }),
    select: (r) => r.total,
    refetchInterval: 30_000,
  });
}

/** Pseudonymised learner progress for a queued upload (admin only). Lazy — `enabled` from the panel state. */
export function useQueueProgress(uploadId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['staff-queue-progress', uploadId],
    queryFn: () => reviewApi.progress(uploadId),
    enabled,
  });
}
