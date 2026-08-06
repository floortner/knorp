import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { exerciseSchema, solvableExerciseSchema, EXERCISE_TYPES } from './exercise';
import { unitSchema } from './models';

/**
 * Drift gate: the golden fixtures must satisfy the backend contract schemas that publish the
 * OpenAPI. If the contract and the fixtures diverge, this fails before the frontend types do.
 *
 * The backend owns its OWN committed copy (backend/fixtures/) so it stays independently buildable
 * after the repo split (CLAUDE.md); while the monorepo lasts, a second gate below pins the frontend's
 * copies byte-identical so the two projects test against the same goldens.
 *
 * The item_bank.seed.json solvability gate was dropped along with the seed content itself — re-add once
 * new content is seeded.
 */
const fixtures = join(__dirname, '..', '..', 'fixtures');
const frontendFixtures = join(__dirname, '..', '..', '..', 'frontend', 'fixtures');
const FIXTURE_NAMES = ['session.example.json', 'session-assigned.example.json', 'units.example.json'];

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

  it('the ASSIGNED session fixture parses, is solvable, and carries the Merksatz intro (§H1)', () => {
    const fixture = load('session-assigned.example.json');
    expect(typeof fixture.intro).toBe('string');
    expect(fixture.unit).toBeUndefined(); // assigned sessions have no unit
    for (const item of fixture.items as unknown[]) {
      const parsed = solvableExerciseSchema.safeParse(item);
      if (!parsed.success) {
        throw new Error(`exercise ${(item as { id?: string }).id}: ${parsed.error.message}`);
      }
    }
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

  // Monorepo-only: both projects must test against the SAME goldens. Skipped automatically once the
  // repo split removes the sibling checkout (the backend copy then stands alone).
  it.skipIf(!existsSync(frontendFixtures))('backend and frontend fixture copies are byte-identical', () => {
    for (const name of FIXTURE_NAMES) {
      expect(readFileSync(join(fixtures, name), 'utf-8'), name).toBe(
        readFileSync(join(frontendFixtures, name), 'utf-8'),
      );
    }
  });
});
