import { describe, it, expect } from 'vitest';
import { exerciseSchema, solvableExerciseSchema } from './exercise';

/** A minimal valid base; override per case. */
const base = {
  id: 'x',
  audioUrl: null,
  skillTags: ['placeholder'],
  praise: 'Super!',
};

describe('exerciseSchema — skill-tag taxonomy', () => {
  it('rejects an unknown skill tag', () => {
    const ex = { type: 'placeholder', prompt: 'Was passt?', options: ['a', 'b'], answer: 'a', ...base, skillTags: ['rhyme'] };
    expect(exerciseSchema.safeParse(ex).success).toBe(false);
  });

  it('rejects an empty skillTags array', () => {
    const ex = { type: 'placeholder', prompt: 'Was passt?', options: ['a', 'b'], answer: 'a', ...base, skillTags: [] };
    expect(exerciseSchema.safeParse(ex).success).toBe(false);
  });

  it('accepts a known skill tag', () => {
    const ex = { type: 'placeholder', prompt: 'Was passt?', options: ['a', 'b'], answer: 'a', ...base };
    expect(exerciseSchema.safeParse(ex).success).toBe(true);
  });
});

describe('solvableExerciseSchema — per-type solvability', () => {
  it('placeholder: answer must be among options', () => {
    const good = { type: 'placeholder', prompt: 'Was passt?', options: ['a', 'b', 'c'], answer: 'b', ...base };
    const bad = { ...good, answer: 'z' };
    expect(solvableExerciseSchema.safeParse(good).success).toBe(true);
    expect(solvableExerciseSchema.safeParse(bad).success).toBe(false);
  });
});
