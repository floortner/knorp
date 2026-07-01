import { describe, it, expect } from 'vitest';
import { exerciseSchema, solvableExerciseSchema } from './exercise';

/** A minimal valid base for a single-choice exercise; override per case. */
const base = {
  id: 'x',
  audioUrl: null,
  skillTags: ['rhyme'],
  praise: 'Super!',
};

describe('exerciseSchema — skill-tag taxonomy', () => {
  it('rejects an unknown skill tag', () => {
    const ex = { type: 'rhyme', word: 'Haus', options: ['Maus', 'Baum'], answer: 'Maus', ...base, skillTags: ['not_a_real_tag'] };
    expect(exerciseSchema.safeParse(ex).success).toBe(false);
  });

  it('rejects an empty skillTags array', () => {
    const ex = { type: 'rhyme', word: 'Haus', options: ['Maus', 'Baum'], answer: 'Maus', ...base, skillTags: [] };
    expect(exerciseSchema.safeParse(ex).success).toBe(false);
  });

  it('accepts a known skill tag', () => {
    const ex = { type: 'rhyme', word: 'Haus', options: ['Maus', 'Baum'], answer: 'Maus', ...base };
    expect(exerciseSchema.safeParse(ex).success).toBe(true);
  });
});

describe('solvableExerciseSchema — per-type solvability', () => {
  it('single-choice: answer must be among options', () => {
    const good = { type: 'rhyme', word: 'Haus', options: ['Maus', 'Baum'], answer: 'Maus', ...base };
    const bad = { type: 'rhyme', word: 'Haus', options: ['Baum', 'Ball'], answer: 'Maus', ...base };
    expect(solvableExerciseSchema.safeParse(good).success).toBe(true);
    expect(solvableExerciseSchema.safeParse(bad).success).toBe(false);
  });

  it('count: answer must be among opts', () => {
    const good = { type: 'count', word: 'Sonne', syll: ['Son', 'ne'], answer: 2, opts: [2, 3], ...base, skillTags: ['syllable_count'] };
    const bad = { type: 'count', word: 'Sonne', syll: ['Son', 'ne'], answer: 2, opts: [3, 4], ...base, skillTags: ['syllable_count'] };
    expect(solvableExerciseSchema.safeParse(good).success).toBe(true);
    expect(solvableExerciseSchema.safeParse(bad).success).toBe(false);
  });

  it('order/arrange: tiles must be a permutation of syll', () => {
    const good = { type: 'order', word: 'Sonne', syll: ['Son', 'ne'], tiles: ['ne', 'Son'], ...base, skillTags: ['syllable_order'] };
    const bad = { type: 'order', word: 'Sonne', syll: ['Son', 'ne'], tiles: ['ne', 'Mon'], ...base, skillTags: ['syllable_order'] };
    expect(solvableExerciseSchema.safeParse(good).success).toBe(true);
    expect(solvableExerciseSchema.safeParse(bad).success).toBe(false);
  });

  it('pairs: both pair members must be among tiles', () => {
    const good = { type: 'pairs', tiles: ['Maus', 'Haus', 'Baum', 'Traum'], pair: ['Maus', 'Haus'], ...base, skillTags: ['rhyme_pairs'] };
    const bad = { type: 'pairs', tiles: ['Maus', 'Baum', 'Traum', 'Ball'], pair: ['Maus', 'Haus'], ...base, skillTags: ['rhyme_pairs'] };
    expect(solvableExerciseSchema.safeParse(good).success).toBe(true);
    expect(solvableExerciseSchema.safeParse(bad).success).toBe(false);
  });

  it('build: answer must be spellable from tiles', () => {
    const good = { type: 'build', emoji: '🐟', word: 'Fisch', tiles: ['F', 'i', 's', 'c', 'h'], answer: ['F', 'i', 's', 'c', 'h'], ...base, skillTags: ['spelling'] };
    const bad = { type: 'build', emoji: '🐟', word: 'Fisch', tiles: ['F', 'i', 's'], answer: ['F', 'i', 's', 'c', 'h'], ...base, skillTags: ['spelling'] };
    expect(solvableExerciseSchema.safeParse(good).success).toBe(true);
    expect(solvableExerciseSchema.safeParse(bad).success).toBe(false);
  });

  it('odd/sentence: answer must be among the presented tokens', () => {
    const odd = { type: 'odd', words: ['Maus', 'Haus', 'Baum', 'Ball'], answer: 'Ball', instruction: 'Was reimt nicht?', ...base, skillTags: ['odd_one_out'] };
    const oddBad = { ...odd, answer: 'Turm' };
    expect(solvableExerciseSchema.safeParse(odd).success).toBe(true);
    expect(solvableExerciseSchema.safeParse(oddBad).success).toBe(false);
  });

  it('swipe: always solvable (fixed left/right enum)', () => {
    const ex = { type: 'swipe', word: 'Hund', leftLabel: 'Tier', rightLabel: 'Ding', answer: 'left', ...base, skillTags: ['binary_sort'] };
    expect(solvableExerciseSchema.safeParse(ex).success).toBe(true);
  });
});
