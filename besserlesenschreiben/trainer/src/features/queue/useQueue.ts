import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { reviewApi, type QueueFilter } from '@/lib/endpoints';

export type { QueueFilter };

const PAGE_SIZE = 50;

/**
 * The review pipeline as an infinite, cursor-paged list ("Mehr laden"). Rows carry the student name (known-trainer §H1.3).
 * Keyed under ['staff-queue', 'list', …] — distinct from the single item the review screen caches at
 * ['staff-queue', 'item', id] (different data shape); the shared 'staff-queue' prefix still invalidates both.
 */
export function useQueue(status: QueueFilter = 'open') {
  return useInfiniteQuery({
    queryKey: ['staff-queue', 'list', status],
    queryFn: ({ pageParam }) => reviewApi.queue({ status, limit: PAGE_SIZE, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
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

/** Learner progress for a queued upload (all trainers — known-trainer §H1.3). Lazy — `enabled` from the panel state. */
export function useQueueProgress(uploadId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['staff-queue-progress', uploadId],
    queryFn: () => reviewApi.progress(uploadId),
    enabled,
  });
}
