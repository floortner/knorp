import { useQuery } from '@tanstack/react-query';
import { reviewApi } from '@/lib/endpoints';

/** The pending-review queue (first page). Pseudonymised rows; cursor paging is wired in `reviewApi`. */
export function useQueue() {
  return useQuery({
    queryKey: ['staff-queue'],
    queryFn: () => reviewApi.queue({ limit: 50 }),
    // Small fixed staff pool — a short refetch keeps the shared queue roughly live without polling hard.
    refetchInterval: 30_000,
  });
}
