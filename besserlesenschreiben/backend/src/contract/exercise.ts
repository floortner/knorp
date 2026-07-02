import { z } from 'zod';
import { skillTagSchema } from './skills';

/**
 * The wire `Exercise` discriminated union — the single source of truth for the 14 Vokaltraining exercise
 * types (SPEC §8 / frontend SPEC §3). The program is the owner's FRESCH-style vowel training: Wortraster,
 * kurz/lang-Vokal, Quatschwörter, Silben-Gültigkeit, Komposita and Wortfamilien. Used to (a) publish the
 * OpenAPI the frontend types from, (b) drift-gate the golden fixtures, and (c) validate LLM-generated
 * exercise content.
 *
 * `exerciseSchema` is the pure discriminated union (the wire/OpenAPI shape). `solvableExerciseSchema`
 * layers per-type SOLVABILITY refinements on top — the same schema guards seed content and LLM output, so
 * a generated exercise whose answer isn't among its options (etc.) is rejected before it can reach a child.
 * Solvability can't be expressed in JSON Schema, so it lives here as a runtime refinement, not on the wire.
 */

// Fields every served exercise carries (added by the backend's exercise mapper).
const media = {
  id: z.string(),
  audioUrl: z.string().nullable(),
  syllableAudio: z.array(z.string()).nullable().optional(),
  skillTags: z.array(skillTagSchema).min(1),
  praise: z.string(),
};

/** raster: decompose a monosyllable into Anfang · Vokal · Ende on the Wortraster (line · yellow circle · line) */
const raster = z.object({ type: z.literal('raster'), word: z.string(), onset: z.string(), vowel: z.string(), coda: z.string(), tiles: z.array(z.string()).length(3), ...media });

/** findvowel: the word shown as letter chips (ie/au/ei are one chip) — tap the Selbstlaut */
const findvowel = z.object({ type: z.literal('findvowel'), word: z.string(), letters: z.array(z.string()), answer: z.string(), ...media });

/** realword: echtes Wort oder Quatschwort? (swipe) */
const realword = z.object({ type: z.literal('realword'), word: z.string(), answer: z.enum(['wort', 'quatsch']), ...media });

/** fixvowel: a Quatschwort plus the target vowel — pick the real word it becomes (Hend + a → Hand) */
const fixvowel = z.object({ type: z.literal('fixvowel'), pseudo: z.string(), vowel: z.string(), options: z.array(z.string()), answer: z.string(), ...media });

/** swapvowel: swap the vowel to make a new real word — ANY vowel in `answers` is correct (Wind → a or u) */
const swapvowel = z.object({ type: z.literal('swapvowel'), word: z.string(), options: z.array(z.string()), answers: z.array(z.string()).min(1), ...media });

/** length: kurzer oder langer Vokal? (swipe; hint carries the doc's reasoning, e.g. "nd = Stopper") */
const length = z.object({ type: z.literal('length'), word: z.string(), vowel: z.string(), answer: z.enum(['kurz', 'lang']), hint: z.string().optional(), ...media });

/** sylvalid: kann diese Silbe klingen (hat sie einen Selbstlaut)? (swipe ja/nein) */
const sylvalid = z.object({ type: z.literal('sylvalid'), syllable: z.string(), answer: z.enum(['ja', 'nein']), ...media });

/** insertvowel: fill the single `_` in the pattern with a vowel to make the word (B_ch → u → Buch) */
const insertvowel = z.object({ type: z.literal('insertvowel'), pattern: z.string(), word: z.string(), options: z.array(z.string()), answer: z.string(), ...media });

/** paircheck: two syllables side by side — gleich oder anders? (swipe; trains exact visual discrimination) */
const paircheck = z.object({ type: z.literal('paircheck'), left: z.string(), right: z.string(), answer: z.enum(['gleich', 'anders']), ...media });

/** pickword: one word in the row has the right vowel and is real — tap it (Berof·Berit·Beruf…) */
const pickword = z.object({ type: z.literal('pickword'), options: z.array(z.string()).min(3), answer: z.string(), ...media });

/** sentencefix: one word in the sentence has a wrong vowel — tap it; `correction` is revealed on solve */
const sentencefix = z.object({ type: z.literal('sentencefix'), tokens: z.array(z.string()), answer: z.string(), correction: z.string(), ...media });

/** compound: the compound's two parts are shown (teaches the split) — pick the article of the Grundwort */
const compound = z.object({ type: z.literal('compound'), word: z.string(), parts: z.tuple([z.string(), z.string()]), options: z.array(z.string()), answer: z.string(), ...media });

/** family: which word belongs to the Wortfamilie of `stem`? (einmal h, immer h) */
const family = z.object({ type: z.literal('family'), stem: z.string(), options: z.array(z.string()), answer: z.string(), ...media });

/** sylarrange: lay a multi-syllable word from shuffled syllable tiles (Ganzes → Silben → Ganzes) */
const sylarrange = z.object({ type: z.literal('sylarrange'), word: z.string(), syll: z.array(z.string()), tiles: z.array(z.string()), ...media });

export const exerciseSchema = z.discriminatedUnion('type', [
  raster, findvowel, realword, fixvowel, swapvowel, length, sylvalid,
  insertvowel, paircheck, pickword, sentencefix, compound, family, sylarrange,
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

/** Same multiset both ways — the tiles are exactly a reordering of the target parts. */
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
    case 'raster':
      if (!sameMultiset(ex.tiles, [ex.onset, ex.vowel, ex.coda]))
        fail('tiles are not a permutation of onset/vowel/coda', ['tiles']);
      if (ex.onset + ex.vowel + ex.coda !== ex.word)
        fail('onset+vowel+coda does not spell word', ['word']);
      break;
    case 'findvowel':
      if (!ex.letters.includes(ex.answer)) fail(`answer "${ex.answer}" is not among letters`, ['answer']);
      if (ex.letters.join('').toLowerCase() !== ex.word.toLowerCase())
        fail('letters do not spell word', ['letters']);
      break;
    // Single-choice: the correct answer must be selectable.
    case 'fixvowel':
    case 'pickword':
    case 'compound':
    case 'family':
      if (!ex.options.includes(ex.answer)) fail(`answer "${ex.answer}" is not among options`, ['answer']);
      break;
    case 'swapvowel':
      if (!ex.answers.every((a) => ex.options.includes(a)))
        fail('every accepted answer must be among options', ['answers']);
      break;
    case 'insertvowel': {
      if (!ex.options.includes(ex.answer)) fail(`answer "${ex.answer}" is not among options`, ['answer']);
      const gaps = ex.pattern.split('_').length - 1;
      if (gaps !== 1) fail('pattern must contain exactly one "_"', ['pattern']);
      else if (ex.pattern.replace('_', ex.answer) !== ex.word)
        fail('pattern with answer inserted does not spell word', ['word']);
      break;
    }
    case 'paircheck':
      if ((ex.left === ex.right) !== (ex.answer === 'gleich'))
        fail('answer contradicts the left/right comparison', ['answer']);
      break;
    case 'sentencefix':
      if (!ex.tokens.includes(ex.answer)) fail(`answer "${ex.answer}" is not among tokens`, ['answer']);
      break;
    // Tile-order: the shuffled tiles must be exactly a reordering of the target.
    case 'sylarrange':
      if (!sameMultiset(ex.tiles, ex.syll)) fail('tiles are not a permutation of syll', ['tiles']);
      break;
    // Fixed-enum answers (realword/length/sylvalid) are always solvable.
    case 'realword':
    case 'length':
    case 'sylvalid':
      break;
  }

  // compound: the two shown parts must actually spell the compound (case-insensitive at the seam).
  if (ex.type === 'compound') {
    const [p1, p2] = ex.parts;
    if ((p1 + p2).toLowerCase() !== ex.word.toLowerCase())
      fail('parts do not spell the compound word', ['parts']);
  }
});

/** The exercise type discriminants, for tests/iteration. */
export const EXERCISE_TYPES = [
  'raster', 'findvowel', 'realword', 'fixvowel', 'swapvowel', 'length', 'sylvalid',
  'insertvowel', 'paircheck', 'pickword', 'sentencefix', 'compound', 'family', 'sylarrange',
] as const;
