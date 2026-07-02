import { describe, it, expect } from 'vitest';
import type { Exercise } from '@/lib/types';
import session from '../../../fixtures/session.example.json';
import { promptAndExpected } from './derive';

const items = (session as unknown as { items: Exercise[] }).items;

const byType = (t: string) => items.find((i) => i.type === t)!;

describe('promptAndExpected', () => {
  it('derives prompt + expected for every one of the 14 fixture types without throwing', () => {
    expect(items).toHaveLength(14);
    for (const ex of items) {
      const { prompt, expected } = promptAndExpected(ex);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
      expect(typeof expected).toBe('string');
      expect(expected.length).toBeGreaterThan(0);
    }
  });

  it('uses the answer for choice types', () => {
    expect(promptAndExpected(byType('findvowel'))).toEqual({ prompt: 'Schal', expected: 'a' });
    expect(promptAndExpected(byType('fixvowel'))).toEqual({ prompt: 'Hend→a', expected: 'Hand' });
    expect(promptAndExpected(byType('pickword'))).toEqual({
      prompt: 'Berof Berit Beref Beruf Berat Berif',
      expected: 'Beruf',
    });
    expect(promptAndExpected(byType('compound'))).toEqual({ prompt: 'Holztreppe', expected: 'die' });
  });

  it('joins the structural parts for raster and sylarrange', () => {
    expect(promptAndExpected(byType('raster'))).toEqual({ prompt: 'Schnur', expected: 'Schn|u|r' });
    expect(promptAndExpected(byType('sylarrange'))).toEqual({
      prompt: 'Gleichgewicht',
      expected: 'Gleich|ge|wicht',
    });
  });

  it('joins all accepted vowels for swapvowel', () => {
    expect(promptAndExpected(byType('swapvowel'))).toEqual({ prompt: 'Hand', expected: 'u' });
  });

  it('uses the sentence and the wrong token for sentencefix', () => {
    expect(promptAndExpected(byType('sentencefix'))).toEqual({
      prompt: 'Die Schöle ist aus.',
      expected: 'Schöle',
    });
  });
});
