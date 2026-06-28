import { describe, it, expect } from 'vitest';
import type { ItemBankModel } from '../../generated/prisma/models';
import { toExercise } from './exercise.mapper';

function bankItem(over: Partial<ItemBankModel>): ItemBankModel {
  return {
    id: 'item-1',
    exerciseType: 'count',
    payload: { word: 'Sommer', syll: ['Som', 'mer'], answer: 2, opts: [2, 3, 4], praise: 'Richtig!' },
    audioUrl: null,
    syllableAudio: null,
    skillTags: ['syllable_count'],
    ...over,
  } as unknown as ItemBankModel;
}

describe('toExercise', () => {
  it('flattens payload into the wire Exercise with id/type/audioUrl/skillTags', () => {
    const ex = toExercise(bankItem({}));
    expect(ex).toMatchObject({
      id: 'item-1',
      type: 'count',
      word: 'Sommer',
      answer: 2,
      audioUrl: null,
      skillTags: ['syllable_count'],
    });
  });

  it('omits syllableAudio when absent but includes it when present', () => {
    expect('syllableAudio' in toExercise(bankItem({ syllableAudio: null }))).toBe(false);
    const withAudio = toExercise(bankItem({ syllableAudio: ['a.mp3', 'b.mp3'] as unknown as ItemBankModel['syllableAudio'] }));
    expect(withAudio.syllableAudio).toEqual(['a.mp3', 'b.mp3']);
  });

  it('passes through a populated audioUrl', () => {
    expect(toExercise(bankItem({ audioUrl: 'https://blob/sommer.mp3' })).audioUrl).toBe(
      'https://blob/sommer.mp3',
    );
  });
});
