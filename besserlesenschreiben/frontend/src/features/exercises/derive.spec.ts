import { describe, it, expect } from 'vitest';
import type { Exercise } from '@/lib/types';
import session from '../../../fixtures/session.example.json';
import { promptAndExpected } from './derive';

const items = (session as unknown as { items: Exercise[] }).items;

const byType = (t: string) => items.find((i) => i.type === t)!;

describe('promptAndExpected', () => {
  it('derives prompt + expected for every one of the 12 fixture types without throwing', () => {
    expect(items).toHaveLength(12);
    for (const ex of items) {
      const { prompt, expected } = promptAndExpected(ex);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
      expect(typeof expected).toBe('string');
      expect(expected.length).toBeGreaterThan(0);
    }
  });

  it('uses the answer for single-choice types', () => {
    expect(promptAndExpected(byType('count'))).toEqual({ prompt: 'Sommer', expected: '2' });
    expect(promptAndExpected(byType('rhyme'))).toEqual({ prompt: 'Maus', expected: 'Haus' });
    expect(promptAndExpected(byType('bd'))).toEqual({ prompt: 'd', expected: 'd' });
  });

  it('uses the joined syllable order for tile-order types', () => {
    expect(promptAndExpected(byType('order'))).toEqual({ prompt: 'Schmetterling', expected: 'Schmet|ter|ling' });
    expect(promptAndExpected(byType('arrange'))).toEqual({ prompt: 'Maus', expected: 'M|a|u|s' });
  });

  it('uses the joined pair for pair-match', () => {
    expect(promptAndExpected(byType('pairs'))).toEqual({ prompt: 'Haus Tisch Maus Ball', expected: 'Haus+Maus' });
  });
});
