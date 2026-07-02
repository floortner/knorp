import { describe, it, expect } from 'vitest';
import type { ItemBankModel } from '../../generated/prisma/models';
import { selectBankItems, weakSkills, type AttemptSignal } from './session-select';

/** Minimal item factory — selection only reads id, skillTags, difficulty. */
function item(id: string, skillTags: string[], difficulty: number): ItemBankModel {
  return { id, skillTags, difficulty } as unknown as ItemBankModel;
}

describe('weakSkills', () => {
  const sig = (skillTags: string[], isCorrect: boolean, timeMs = 1000): AttemptSignal => ({
    skillTags,
    isCorrect,
    timeMs,
  });

  it('flags a skill below the correct-rate threshold', () => {
    const weak = weakSkills([
      sig(['vowel_length'], false),
      sig(['vowel_length'], false),
      sig(['vowel_length'], true),
    ]);
    expect(weak.has('vowel_length')).toBe(true);
  });

  it('does not flag a well-performed skill', () => {
    const weak = weakSkills([sig(['lexical_decision'], true), sig(['lexical_decision'], true), sig(['lexical_decision'], true)]);
    expect(weak.has('lexical_decision')).toBe(false);
  });

  it('flags a skill that is answered correctly but slowly', () => {
    const weak = weakSkills([sig(['word_raster'], true, 20_000), sig(['word_raster'], true, 18_000)]);
    expect(weak.has('word_raster')).toBe(true);
  });
});

describe('selectBankItems', () => {
  it('prioritises items that drill a weak/due skill', () => {
    const items = [
      item('a', ['lexical_decision'], 1),
      item('b', ['vowel_length'], 2),
      item('c', ['word_raster'], 1),
    ];
    const chosen = selectBankItems(items, new Set(['vowel_length']), 1);
    expect(chosen.map((i) => i.id)).toEqual(['b']);
  });

  it('orders the returned session easy→hard', () => {
    const items = [
      item('hard', ['vowel_length'], 3),
      item('easy', ['vowel_length'], 1),
      item('mid', ['vowel_length'], 2),
    ];
    const chosen = selectBankItems(items, new Set(['vowel_length']), 3);
    expect(chosen.map((i) => i.difficulty)).toEqual([1, 2, 3]);
  });

  it('mixes in mastered items for confidence when there is weak work', () => {
    const items = [
      item('w1', ['vowel_length'], 1),
      item('w2', ['vowel_length'], 1),
      item('w3', ['vowel_length'], 1),
      item('m1', ['lexical_decision'], 1),
      item('m2', ['lexical_decision'], 1),
    ];
    const chosen = selectBankItems(items, new Set(['vowel_length']), 4);
    const mastered = chosen.filter((i) => i.skillTags.includes('lexical_decision'));
    expect(mastered.length).toBeGreaterThanOrEqual(1);
    expect(chosen.length).toBe(4);
  });

  it('is deterministic for the same inputs', () => {
    const items = [item('a', ['x'], 1), item('b', ['x'], 1), item('c', ['y'], 1)];
    const one = selectBankItems(items, new Set(['x']), 2).map((i) => i.id);
    const two = selectBankItems(items, new Set(['x']), 2).map((i) => i.id);
    expect(one).toEqual(two);
  });

  it('returns everything (easy→hard) for a new profile with no priority skills', () => {
    const items = [item('b', ['x'], 2), item('a', ['y'], 1)];
    const chosen = selectBankItems(items, new Set(), 8);
    expect(chosen.map((i) => i.id)).toEqual(['a', 'b']);
  });
});
