import { describe, it, expect, beforeEach } from 'vitest';
import { Rating } from 'ts-fsrs';
import { FsrsService } from './fsrs.service';

describe('FsrsService', () => {
  let svc: FsrsService;
  beforeEach(() => {
    svc = new FsrsService();
  });

  describe('ratingFor', () => {
    it('maps a wrong answer to Again', () => {
      expect(svc.ratingFor(false, 1)).toBe(Rating.Again);
      expect(svc.ratingFor(false, 3)).toBe(Rating.Again);
    });
    it('maps a first-try correct answer to Good', () => {
      expect(svc.ratingFor(true, 1)).toBe(Rating.Good);
    });
    it('maps a correct-after-retry answer to Hard', () => {
      expect(svc.ratingFor(true, 2)).toBe(Rating.Hard);
    });
  });

  describe('next', () => {
    const now = new Date('2026-06-25T09:00:00Z');

    it('initialises a brand-new skill (no prior review_state)', () => {
      const f = svc.next(null, true, 1, now);
      expect(f.reps).toBe(1);
      expect(f.lapses).toBe(0);
      expect(f.stability).toBeGreaterThan(0);
      expect(f.due.getTime()).toBeGreaterThan(now.getTime());
      expect(f.lastReview.getTime()).toBe(now.getTime());
    });

    it('schedules a correct review further out than a wrong one', () => {
      const good = svc.next(null, true, 1, now);
      const again = svc.next(null, false, 1, now);
      expect(good.due.getTime()).toBeGreaterThan(again.due.getTime());
    });

    it('counts a lapse when a matured (Review-state) skill is answered wrong', () => {
      // A skill that has graduated to Review (state 2) after several successful reps.
      const matured = {
        stability: 15,
        difficulty: 5,
        state: 2,
        reps: 5,
        lapses: 0,
        elapsedDays: 15,
        scheduledDays: 15,
        due: new Date('2026-06-25T09:00:00Z'),
        lastReview: new Date('2026-06-10T09:00:00Z'),
      };
      const lapse = svc.next(matured, false, 1, new Date('2026-06-26T09:00:00Z'));
      expect(lapse.lapses).toBe(1);
      expect(lapse.reps).toBe(6);
      expect(lapse.state).toBe(3); // Relearning
    });
  });
});
