import type { AssignmentStatus, LectureStatus } from '@/lib/contract';

export const STATUS_LABEL: Record<LectureStatus, string> = {
  draft: 'Entwurf',
  published: 'Veröffentlicht',
};

/** Calm, factual status words — an unfinished assignment is never "überfällig" (no-pressure invariant). */
export const ASSIGNMENT_LABEL: Record<AssignmentStatus, string> = {
  open: 'Offen',
  started: 'Begonnen',
  completed: 'Erledigt',
};
