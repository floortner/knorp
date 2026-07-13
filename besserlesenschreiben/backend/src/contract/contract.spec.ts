import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { exerciseSchema, solvableExerciseSchema, EXERCISE_TYPES } from './exercise';
import { unitSchema } from './models';

/**
 * Drift gate: the golden frontend fixtures must satisfy the backend contract schemas that publish the
 * OpenAPI. If the contract and the fixtures diverge, this fails before the frontend types do.
 *
 * The item_bank.seed.json solvability gate was dropped along with the seed content itself — re-add once
 * new content is seeded.
 */
const fixtures = join(__dirname, '..', '..', '..', 'frontend', 'fixtures');

function load(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(fixtures, name), 'utf-8')) as Record<string, unknown>;
}

describe('contract ↔ golden fixtures', () => {
  it('every exercise in session.example.json parses against exerciseSchema', () => {
    const items = load('session.example.json').items as unknown[];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const parsed = exerciseSchema.safeParse(item);
      if (!parsed.success) {
        throw new Error(`exercise ${(item as { id?: string }).id}: ${parsed.error.message}`);
      }
    }
  });

  it('every exercise in session.example.json is SOLVABLE (answer selectable, tiles permute, etc.)', () => {
    const items = load('session.example.json').items as unknown[];
    for (const item of items) {
      const parsed = solvableExerciseSchema.safeParse(item);
      if (!parsed.success) {
        throw new Error(`exercise ${(item as { id?: string }).id}: ${parsed.error.message}`);
      }
    }
  });

  it('the fixture covers all exercise types', () => {
    const types = (load('session.example.json').items as Array<{ type: string }>).map((i) => i.type);
    expect(new Set(types)).toEqual(new Set(EXERCISE_TYPES));
  });

  it('every unit in units.example.json parses against unitSchema', () => {
    const units = load('units.example.json').units as unknown[];
    for (const unit of units) {
      const parsed = unitSchema.safeParse(unit);
      if (!parsed.success) {
        throw new Error(`unit: ${parsed.error.message}`);
      }
    }
  });
});
