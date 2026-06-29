import { z } from 'zod';

/**
 * The wire `Exercise` discriminated union — the single source of truth for the 17 exercise types
 * (SPEC §8 / frontend SPEC §3). Used to (a) publish the OpenAPI the frontend types from, (b) drift-gate
 * the golden fixtures, and later (c) validate LLM-generated exercise content (`messages.parse`).
 *
 * Field-name gotcha (intentional, do not unify): `count` uses `opts: number[]`; every other
 * single-choice type uses `options: string[]`.
 */

// Fields every served exercise carries (added by the backend's exercise mapper).
const media = {
  id: z.string(),
  audioUrl: z.string().nullable(),
  syllableAudio: z.array(z.string()).nullable().optional(),
  skillTags: z.array(z.string()),
  praise: z.string(),
};

const count = z.object({ type: z.literal('count'), word: z.string(), syll: z.array(z.string()), answer: z.number().int(), opts: z.array(z.number().int()), ...media });
const gap = z.object({ type: z.literal('gap'), word: z.string(), syll: z.array(z.string()), gapIndex: z.number().int(), answer: z.string(), options: z.array(z.string()), ...media });
const order = z.object({ type: z.literal('order'), word: z.string(), syll: z.array(z.string()), tiles: z.array(z.string()), ...media });
const rhyme = z.object({ type: z.literal('rhyme'), word: z.string(), options: z.array(z.string()), answer: z.string(), ...media });
const initial = z.object({ type: z.literal('initial'), word: z.string(), emoji: z.string(), answer: z.string(), options: z.array(z.string()), ...media });
const letter = z.object({ type: z.literal('letter'), word: z.string(), letters: z.array(z.string()), gapIndex: z.number().int(), answer: z.string(), options: z.array(z.string()), ...media });
const caseEx = z.object({ type: z.literal('case'), word: z.string(), emoji: z.string().optional(), answer: z.string(), options: z.array(z.string()), ...media });
const arrange = z.object({ type: z.literal('arrange'), word: z.string(), syll: z.array(z.string()), tiles: z.array(z.string()), ...media });
const nonsense = z.object({ type: z.literal('nonsense'), word: z.string(), answer: z.string(), options: z.array(z.string()), ...media });
const pairs = z.object({ type: z.literal('pairs'), tiles: z.array(z.string()), pair: z.tuple([z.string(), z.string()]), ...media });
const bd = z.object({ type: z.literal('bd'), glyph: z.string(), answer: z.string(), options: z.array(z.string()), ...media });
const vowel = z.object({ type: z.literal('vowel'), word: z.string(), letters: z.array(z.string()), gapIndex: z.number().int(), answer: z.string(), options: z.array(z.string()), ...media });

// ── New exercise types ────────────────────────────────────────────────────────

/** swipe: show a word card, tap/swipe left or right to categorise */
const swipe = z.object({ type: z.literal('swipe'), word: z.string(), leftLabel: z.string(), rightLabel: z.string(), answer: z.enum(['left', 'right']), ...media });

/** odd: four words, tap the one that doesn't share the property */
const odd = z.object({ type: z.literal('odd'), words: z.tuple([z.string(), z.string(), z.string(), z.string()]), answer: z.string(), instruction: z.string(), ...media });

/** listen: audio plays automatically, word is hidden — answer from what you heard */
const listen = z.object({ type: z.literal('listen'), word: z.string(), instruction: z.string(), options: z.array(z.string()), answer: z.string(), ...media });

/** sentence: a tokenised sentence; tap the word that satisfies the instruction */
const sentence = z.object({ type: z.literal('sentence'), tokens: z.array(z.string()), instruction: z.string(), answer: z.string(), ...media });

/** build: tap shuffled letter tiles in order to spell the word shown as an emoji */
const build = z.object({ type: z.literal('build'), emoji: z.string(), word: z.string(), tiles: z.array(z.string()), answer: z.array(z.string()), ...media });

export const exerciseSchema = z.discriminatedUnion('type', [
  count, gap, order, rhyme, initial, letter, caseEx, arrange, nonsense, pairs, bd, vowel,
  swipe, odd, listen, sentence, build,
]);
export type Exercise = z.infer<typeof exerciseSchema>;

/** The exercise type discriminants, for tests/iteration. */
export const EXERCISE_TYPES = [
  'count', 'gap', 'order', 'rhyme', 'initial', 'letter', 'case', 'arrange', 'nonsense', 'pairs', 'bd', 'vowel',
  'swipe', 'odd', 'listen', 'sentence', 'build',
] as const;
