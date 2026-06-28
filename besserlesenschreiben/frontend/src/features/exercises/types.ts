import type { Exercise } from '@/lib/types';

/** The 12-type Exercise union is generated from the backend contract (see lib/api.gen.ts). */
export type { Exercise };
export type ExerciseType = Exercise['type'];

/** Result a renderer reports for a single tap/answer. */
export interface AnswerResult {
  given: string;
  isCorrect: boolean;
}
