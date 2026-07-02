import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { exerciseSchema, solvableExerciseSchema, EXERCISE_TYPES } from './exercise';
import { unitSchema } from './models';

/**
 * Drift gate: the golden frontend fixtures (the render targets for the 14 exercise renderers and the
 * /units home) must satisfy the backend contract schemas that publish the OpenAPI. If the contract and
 * the fixtures diverge, this fails before the frontend types do. The seed item bank is held to the same
 * standard — ~360 hand-derived items must all be provably solvable.
 */
const fixtures = join(__dirname, '..', '..', '..', 'frontend', 'fixtures');
const seedFile = join(__dirname, '..', '..', 'item_bank.seed.json');

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

  it('the fixture covers all 14 exercise types', () => {
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

describe('contract ↔ item_bank.seed.json', () => {
  interface SeedItem {
    seed_key: string;
    unit: number;
    exercise_type: string;
    payload: Record<string, unknown>;
    skill_tags: string[];
  }
  const seed = JSON.parse(readFileSync(seedFile, 'utf-8')) as { items: SeedItem[]; counts: { total: number } };

  it('every seed item composes into a SOLVABLE exercise', () => {
    expect(seed.items.length).toBe(seed.counts.total);
    for (const item of seed.items) {
      // Compose the wire shape exactly like the exercise mapper does at serve time.
      const wire = {
        id: item.seed_key,
        type: item.exercise_type,
        ...item.payload,
        audioUrl: null,
        syllableAudio: null,
        skillTags: item.skill_tags,
      };
      const parsed = solvableExerciseSchema.safeParse(wire);
      if (!parsed.success) {
        throw new Error(`seed ${item.seed_key}: ${parsed.error.message}`);
      }
    }
  });

  it('seed keys are unique', () => {
    const keys = seed.items.map((i) => i.seed_key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
