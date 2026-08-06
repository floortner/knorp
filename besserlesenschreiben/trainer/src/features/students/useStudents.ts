import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { studentsApi } from '@/lib/endpoints';
import type { SessionSource } from '@/lib/contract';

const PAGE_SIZE = 50;

/** The learner directory (all trainers, known-trainer §H1.3): infinite, name-ordered. */
export function useStudents() {
  return useInfiniteQuery({
    queryKey: ['staff-students'],
    queryFn: ({ pageParam }) => studentsApi.list({ limit: PAGE_SIZE, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** One student's progress header (the ProgressPanel payload + identity). */
export function useStudent(profileId: string) {
  return useQuery({
    queryKey: ['staff-student', profileId],
    queryFn: () => studentsApi.detail(profileId),
  });
}

/** The student's assignments — incl. never-started OPEN ones the session timeline can't show. */
export function useStudentAssignments(profileId: string) {
  return useQuery({
    queryKey: ['staff-student-assignments', profileId],
    queryFn: () => studentsApi.assignments(profileId),
  });
}

/** Session history for the activity timeline; optional source filter re-queries server-side. */
export function useStudentSessions(profileId: string, source?: SessionSource) {
  return useInfiniteQuery({
    queryKey: ['staff-student-sessions', profileId, source ?? 'all'],
    queryFn: ({ pageParam }) => studentsApi.sessions(profileId, { limit: PAGE_SIZE, cursor: pageParam, source }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** Question-by-question drill-down for one session. */
export function useSessionDetail(profileId: string, sessionId: string) {
  return useQuery({
    queryKey: ['staff-student-session', sessionId],
    queryFn: () => studentsApi.session(profileId, sessionId),
  });
}
