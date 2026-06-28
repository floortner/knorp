import { Injectable } from '@nestjs/common';
import {
  type Card,
  type FSRS,
  type Grade,
  Rating,
  type State,
  createEmptyCard,
  fsrs,
  generatorParameters,
} from 'ts-fsrs';

/** The subset of `review_state` columns the scheduler reads to rebuild a Card. */
export interface ReviewCardState {
  stability: unknown; // Prisma Decimal | number | null
  difficulty: unknown;
  state: number;
  reps: number;
  lapses: number;
  learningSteps: number;
  elapsedDays: number;
  scheduledDays: number;
  due: Date | null;
  lastReview: Date | null;
}

/** The columns the scheduler writes back to `review_state` after one review. */
export interface NextReviewState {
  stability: number;
  difficulty: number;
  state: number;
  reps: number;
  lapses: number;
  learningSteps: number;
  elapsedDays: number;
  scheduledDays: number;
  due: Date;
  lastReview: Date;
}

/**
 * FSRS scheduling (SPEC §8). Domain logic only — no HTTP, no DB. Scheduling is **per skill_tag**
 * (not per word): every `/attempts` row drives one review per skill the item drilled.
 */
@Injectable()
export class FsrsService {
  private readonly scheduler: FSRS = fsrs(generatorParameters());

  /**
   * Map a child's answer to an FSRS rating. We have no 4-button grading UI, so we infer it:
   *   wrong → Again · first-try correct → Good · correct only after a retry → Hard.
   */
  ratingFor(isCorrect: boolean, attemptNo: number): Grade {
    if (!isCorrect) return Rating.Again;
    return attemptNo > 1 ? Rating.Hard : Rating.Good;
  }

  /** Rebuild a ts-fsrs Card from a stored review_state, or a fresh card when the skill is new. */
  private cardFrom(rs: ReviewCardState | null, now: Date): Card {
    if (!rs || rs.due === null || rs.stability === null) return createEmptyCard(now);
    return {
      due: rs.due,
      stability: Number(rs.stability),
      difficulty: Number(rs.difficulty),
      elapsed_days: rs.elapsedDays,
      scheduled_days: rs.scheduledDays,
      learning_steps: rs.learningSteps,
      reps: rs.reps,
      lapses: rs.lapses,
      state: rs.state as State,
      last_review: rs.lastReview ?? undefined,
    };
  }

  /** Apply one review and return the field set to persist back to `review_state`. */
  next(rs: ReviewCardState | null, isCorrect: boolean, attemptNo: number, now: Date): NextReviewState {
    const { card } = this.scheduler.next(this.cardFrom(rs, now), now, this.ratingFor(isCorrect, attemptNo));
    return {
      stability: card.stability,
      difficulty: card.difficulty,
      state: card.state,
      reps: card.reps,
      lapses: card.lapses,
      learningSteps: card.learning_steps,
      elapsedDays: card.elapsed_days,
      scheduledDays: card.scheduled_days,
      due: card.due,
      lastReview: card.last_review ?? now,
    };
  }
}
