import { describe, it, expect } from 'vitest';
import { exerciseSchema, solvableExerciseSchema } from './exercise';

/** A minimal valid base; override per case. */
const base = {
  id: 'x',
  audioUrl: null,
  skillTags: ['vowel_identify'],
  praise: 'Super!',
};

describe('exerciseSchema — skill-tag taxonomy', () => {
  it('rejects an unknown skill tag', () => {
    const ex = { type: 'findvowel', word: 'Hand', letters: ['H', 'a', 'n', 'd'], answer: 'a', ...base, skillTags: ['rhyme'] };
    expect(exerciseSchema.safeParse(ex).success).toBe(false);
  });

  it('rejects an empty skillTags array', () => {
    const ex = { type: 'findvowel', word: 'Hand', letters: ['H', 'a', 'n', 'd'], answer: 'a', ...base, skillTags: [] };
    expect(exerciseSchema.safeParse(ex).success).toBe(false);
  });

  it('accepts a known skill tag', () => {
    const ex = { type: 'findvowel', word: 'Hand', letters: ['H', 'a', 'n', 'd'], answer: 'a', ...base };
    expect(exerciseSchema.safeParse(ex).success).toBe(true);
  });
});

describe('solvableExerciseSchema — per-type solvability', () => {
  it('raster: tiles must permute onset/vowel/coda and the parts must spell the word', () => {
    const good = { type: 'raster', word: 'Glas', onset: 'Gl', vowel: 'a', coda: 's', tiles: ['a', 's', 'Gl'], ...base, skillTags: ['word_raster'] };
    const wrongTiles = { ...good, tiles: ['a', 's', 'Kl'] };
    const wrongParts = { ...good, coda: 'z', tiles: ['a', 'z', 'Gl'] };
    expect(solvableExerciseSchema.safeParse(good).success).toBe(true);
    expect(solvableExerciseSchema.safeParse(wrongTiles).success).toBe(false);
    expect(solvableExerciseSchema.safeParse(wrongParts).success).toBe(false);
  });

  it('findvowel: answer must be one of the letter chips and the chips must spell the word', () => {
    const good = { type: 'findvowel', word: 'Schal', letters: ['Sch', 'a', 'l'], answer: 'a', ...base };
    const badAnswer = { ...good, answer: 'e' };
    const badLetters = { ...good, letters: ['Sch', 'a', 'll'] };
    expect(solvableExerciseSchema.safeParse(good).success).toBe(true);
    expect(solvableExerciseSchema.safeParse(badAnswer).success).toBe(false);
    expect(solvableExerciseSchema.safeParse(badLetters).success).toBe(false);
  });

  it('single-choice (fixvowel/pickword/family): answer must be among options', () => {
    const good = { type: 'fixvowel', pseudo: 'Hend', vowel: 'a', options: ['Hand', 'Hund', 'Held'], answer: 'Hand', ...base, skillTags: ['vowel_substitution'] };
    const bad = { ...good, answer: 'Haus' };
    expect(solvableExerciseSchema.safeParse(good).success).toBe(true);
    expect(solvableExerciseSchema.safeParse(bad).success).toBe(false);

    const pick = { type: 'pickword', options: ['Berof', 'Berit', 'Beruf', 'Beref'], answer: 'Beruf', ...base, skillTags: ['lexical_decision'] };
    expect(solvableExerciseSchema.safeParse(pick).success).toBe(true);
    expect(solvableExerciseSchema.safeParse({ ...pick, answer: 'Berufe' }).success).toBe(false);

    const fam = { type: 'family', stem: 'fahr-', options: ['Fahrrad', 'Zahnarzt', 'Wohnung'], answer: 'Fahrrad', ...base, skillTags: ['word_family', 'dehnung_h'] };
    expect(solvableExerciseSchema.safeParse(fam).success).toBe(true);
    expect(solvableExerciseSchema.safeParse({ ...fam, answer: 'Fahrt' }).success).toBe(false);
  });

  it('swapvowel: every accepted answer must be among options, at least one required', () => {
    const good = { type: 'swapvowel', word: 'Wind', options: ['a', 'o', 'u'], answers: ['a', 'u'], ...base, skillTags: ['vowel_substitution'] };
    const bad = { ...good, answers: ['a', 'e'] };
    const empty = { ...good, answers: [] };
    expect(solvableExerciseSchema.safeParse(good).success).toBe(true);
    expect(solvableExerciseSchema.safeParse(bad).success).toBe(false);
    expect(solvableExerciseSchema.safeParse(empty).success).toBe(false);
  });

  it('insertvowel: pattern needs exactly one gap and answer must produce the word', () => {
    const good = { type: 'insertvowel', pattern: 'B_ch', word: 'Buch', options: ['a', 'u', 'i'], answer: 'u', ...base };
    const wrongWord = { ...good, word: 'Bach' };
    const twoGaps = { ...good, pattern: 'B__h' };
    expect(solvableExerciseSchema.safeParse(good).success).toBe(true);
    expect(solvableExerciseSchema.safeParse(wrongWord).success).toBe(false);
    expect(solvableExerciseSchema.safeParse(twoGaps).success).toBe(false);
  });

  it('paircheck: answer must match the actual comparison', () => {
    const same = { type: 'paircheck', left: 'pla', right: 'pla', answer: 'gleich', ...base, skillTags: ['visual_discrimination'] };
    const diff = { type: 'paircheck', left: 'kram', right: 'kran', answer: 'anders', ...base, skillTags: ['visual_discrimination'] };
    const lie = { ...diff, answer: 'gleich' };
    expect(solvableExerciseSchema.safeParse(same).success).toBe(true);
    expect(solvableExerciseSchema.safeParse(diff).success).toBe(true);
    expect(solvableExerciseSchema.safeParse(lie).success).toBe(false);
  });

  it('sentencefix: the wrong word must be one of the sentence tokens', () => {
    const good = { type: 'sentencefix', tokens: ['Die', 'Schöle', 'ist', 'aus.'], answer: 'Schöle', correction: 'Schule', ...base, skillTags: ['vowel_substitution', 'sentence_context'] };
    const bad = { ...good, answer: 'Schule' };
    expect(solvableExerciseSchema.safeParse(good).success).toBe(true);
    expect(solvableExerciseSchema.safeParse(bad).success).toBe(false);
  });

  it('compound: parts must spell the compound (case-insensitive seam) and answer among options', () => {
    const good = { type: 'compound', word: 'Holztreppe', parts: ['Holz', 'Treppe'], options: ['der', 'die', 'das'], answer: 'die', ...base, skillTags: ['compound_word', 'article'] };
    const badParts = { ...good, parts: ['Holz', 'Leiter'] };
    const badAnswer = { ...good, answer: 'den' };
    expect(solvableExerciseSchema.safeParse(good).success).toBe(true);
    expect(solvableExerciseSchema.safeParse(badParts).success).toBe(false);
    expect(solvableExerciseSchema.safeParse(badAnswer).success).toBe(false);
  });

  it('sylarrange: tiles must be a permutation of syll', () => {
    const good = { type: 'sylarrange', word: 'Wintermantel', syll: ['Win', 'ter', 'man', 'tel'], tiles: ['man', 'Win', 'tel', 'ter'], ...base, skillTags: ['syllable_segmentation'] };
    const bad = { ...good, tiles: ['man', 'Win', 'tel', 'der'] };
    expect(solvableExerciseSchema.safeParse(good).success).toBe(true);
    expect(solvableExerciseSchema.safeParse(bad).success).toBe(false);
  });

  it('fixed-enum types (realword/length/sylvalid) are always solvable', () => {
    const real = { type: 'realword', word: 'Horn', answer: 'wort', ...base, skillTags: ['lexical_decision'] };
    const quatsch = { type: 'realword', word: 'brtz', answer: 'quatsch', ...base, skillTags: ['lexical_decision'] };
    const len = { type: 'length', word: 'stand', vowel: 'a', answer: 'kurz', hint: 'nd = zwei Konsonanten (Stopper)', ...base, skillTags: ['vowel_length'] };
    const syl = { type: 'sylvalid', syllable: 'brt', answer: 'nein', ...base, skillTags: ['syllable_validity'] };
    for (const ex of [real, quatsch, len, syl]) {
      expect(solvableExerciseSchema.safeParse(ex).success).toBe(true);
    }
  });
});
