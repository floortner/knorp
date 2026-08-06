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

/** Matching tint classes, shared by the lecture outcomes table and the student's Zuweisungen list. */
export const ASSIGNMENT_TONE: Record<AssignmentStatus, string> = {
  open: 'bg-black/[0.04] text-ink-soft',
  started: 'bg-teal-tint text-teal-dark',
  completed: 'bg-good-tint text-good',
};
