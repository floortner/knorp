import { describe, it, expect } from 'vitest';
import type { ItemBankModel } from '../../generated/prisma/models';
import { toExercise } from './exercise.mapper';

function bankItem(over: Partial<ItemBankModel>): ItemBankModel {
  return {
    id: 'item-1',
    exerciseType: 'findvowel',
    payload: { word: 'Hand', letters: ['H', 'a', 'n', 'd'], answer: 'a', praise: 'Richtig!' },
    audioUrl: null,
    syllableAudio: null,
    skillTags: ['vowel_identify'],
    ...over,
  } as unknown as ItemBankModel;
}

describe('toExercise', () => {
  it('flattens payload into the wire Exercise with id/type/audioUrl/skillTags', () => {
    const ex = toExercise(bankItem({}));
    expect(ex).toMatchObject({
      id: 'item-1',
      type: 'findvowel',
      word: 'Hand',
      answer: 'a',
      audioUrl: null,
      skillTags: ['vowel_identify'],
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
