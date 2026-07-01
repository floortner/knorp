import { z } from 'zod';
import { skillTagSchema } from './skills';

/**
 * The wire `Exercise` discriminated union — the single source of truth for the 17 exercise types
 * (SPEC §8 / frontend SPEC §3). Used to (a) publish the OpenAPI the frontend types from, (b) drift-gate
 * the golden fixtures, and (c) validate LLM-generated exercise content.
 *
 * `exerciseSchema` is the pure discriminated union (the wire/OpenAPI shape). `solvableExerciseSchema`
 * layers per-type SOLVABILITY refinements on top — the same schema guards seed content and LLM output, so
 * a generated exercise whose answer isn't among its options (etc.) is rejected before it can reach a child.
 * Solvability can't be expressed in JSON Schema, so it lives here as a runtime refinement, not on the wire.
 *
 * Field-name gotcha (intentional, do not unify): `count` uses `opts: number[]`; every other
 * single-choice type uses `options: string[]`.
 */

// Fields every served exercise carries (added by the backend's exercise mapper).
const media = {
  id: z.string(),
  audioUrl: z.string().nullable(),
  syllableAudio: z.array(z.string()).nullable().optional(),
  skillTags: z.array(skillTagSchema).min(1),
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

/** True iff `superset` contains every element of `sub`, counting multiplicity (a multiset ⊆ check). */
function isMultisetSubset(sub: readonly string[], superset: readonly string[]): boolean {
  const counts = new Map<string, number>();
  for (const s of superset) counts.set(s, (counts.get(s) ?? 0) + 1);
  for (const s of sub) {
    const n = counts.get(s) ?? 0;
    if (n === 0) return false;
    counts.set(s, n - 1);
  }
  return true;
}

/** Same multiset both ways — the tiles are exactly a reordering of the syllables. */
function sameMultiset(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && isMultisetSubset(a, b);
}

/**
 * The Exercise contract PLUS per-type solvability — every generated/seeded exercise must be unambiguously
 * answerable. Use this to validate content (LLM output, seed rows, golden fixtures); use the plain
 * `exerciseSchema` for the wire/OpenAPI shape (JSON Schema can't encode these cross-field rules).
 */
export const solvableExerciseSchema = exerciseSchema.superRefine((ex, ctx) => {
  const fail = (message: string, path: (string | number)[] = []) =>
    ctx.addIssue({ code: 'custom', message, path });

  switch (ex.type) {
    // Single-choice (string options): the correct answer must be selectable.
    case 'gap':
    case 'rhyme':
    case 'initial':
    case 'letter':
    case 'case':
    case 'nonsense':
    case 'vowel':
    case 'listen':
      if (!ex.options.includes(ex.answer)) fail(`answer "${ex.answer}" is not among options`, ['answer']);
      break;
    case 'bd':
      if (!ex.options.includes(ex.answer)) fail(`answer "${ex.answer}" is not among options`, ['answer']);
      break;
    case 'count':
      if (!ex.opts.includes(ex.answer)) fail(`answer ${ex.answer} is not among opts`, ['answer']);
      break;
    // Tile-order: the shuffled tiles must be exactly a reordering of the target.
    case 'order':
    case 'arrange':
      if (!sameMultiset(ex.tiles, ex.syll)) fail('tiles are not a permutation of syll', ['tiles']);
      break;
    case 'build':
      if (!isMultisetSubset(ex.answer, ex.tiles)) fail('answer cannot be spelled from tiles', ['answer']);
      break;
    // Pair-match: both members of the pair must be present as tiles.
    case 'pairs':
      if (!ex.pair.every((p) => ex.tiles.includes(p))) fail('pair members must be among tiles', ['pair']);
      break;
    // Odd-one-out / sentence: the answer must be one of the presented tokens.
    case 'odd':
      if (!ex.words.includes(ex.answer)) fail(`answer "${ex.answer}" is not among words`, ['answer']);
      break;
    case 'sentence':
      if (!ex.tokens.includes(ex.answer)) fail(`answer "${ex.answer}" is not among tokens`, ['answer']);
      break;
    // swipe: answer is a fixed enum (left|right) — always solvable.
    case 'swipe':
      break;
  }
});

/** The exercise type discriminants, for tests/iteration. */
export const EXERCISE_TYPES = [
  'count', 'gap', 'order', 'rhyme', 'initial', 'letter', 'case', 'arrange', 'nonsense', 'pairs', 'bd', 'vowel',
  'swipe', 'odd', 'listen', 'sentence', 'build',
] as const;
