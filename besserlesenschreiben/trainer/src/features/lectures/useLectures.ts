import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lecturesApi } from '@/lib/endpoints';
import type { AssignBody } from '@/lib/contract';

const PAGE_SIZE = 50;

/** All current lectures from the content library, newest-updated first — the Lektionen list. */
export function useLectures() {
  return useInfiniteQuery({
    queryKey: ['staff-lectures'],
    queryFn: ({ pageParam }) => lecturesApi.list({ limit: PAGE_SIZE, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useLecture(lectureId: string) {
  return useQuery({
    queryKey: ['staff-lecture', lectureId],
    queryFn: () => lecturesApi.detail(lectureId),
  });
}

/** Per-student assignment status for one lecture (open | started | completed + outcome rollup). */
export function useLectureAssignments(lectureId: string, enabled = true) {
  return useQuery({
    queryKey: ['staff-lecture-assignments', lectureId],
    queryFn: () => lecturesApi.assignments(lectureId),
    enabled,
  });
}

/**
 * Assign/withdraw — the portal's only lecture writes since §I3 (authoring lives in the content
 * library and arrives via the deploy import). Every mutation invalidates the lecture prefix.
 */
export function useLectureMutations(lectureId?: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['staff-lectures'] });
    if (lectureId) {
      void qc.invalidateQueries({ queryKey: ['staff-lecture', lectureId] });
      void qc.invalidateQueries({ queryKey: ['staff-lecture-assignments', lectureId] });
    }
  };
  return {
    assign: useMutation({
      mutationFn: (body: AssignBody) => lecturesApi.assign(lectureId!, body),
      onSuccess: invalidate,
    }),
    withdraw: useMutation({
      mutationFn: (assignmentId: string) => lecturesApi.withdraw(lectureId!, assignmentId),
      onSuccess: invalidate,
    }),
  };
}
