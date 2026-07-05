/**
 * scripts/gen-items-from-lexemes.ts — generate item_bank CANDIDATE rows from the curated lexeme
 * foundation (`npm run gen:items`). Turns the annotated word pool into playable exercises for the
 * skills the pool can ground, reusing `solvableExerciseSchema` as the gate — anything unsolvable is
 * logged and dropped, never emitted.
 *
 * Output is a *candidates* file (item_bank.generated.json), NOT item_bank.seed.json: this is children's
 * content, so a human reviews it and copies the good rows into the seed file (where the existing golden
 * + solvability tests re-validate them). Reads the LIVE lexeme table (base ⊕ overrides ⊕ reviewer edits),
 * so run it against a seeded DB, same as `npm run export:overrides`.
 *
 * Generators (one per unlocked skill):
 *   syllable_segmentation → sylarrange   (needs syllableCount ≥ 2 — already in the data)
 *   word_family           → family       (needs curated `familyStem`)
 *   compound_word/article → compound     (needs curated `compoundParts` + the Grundwort's genus)
 *   double_consonant      → length:kurz  (best-effort vowel via the doubled consonant)
 *   dehnung_h             → length:lang  (best-effort vowel via the stummes/silbisches h)
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import type { ItemBankModel } from '../src/generated/prisma/models';
import { solvableExerciseSchema } from '../src/contract/exercise';
import { toExercise } from '../src/modules/sessions/exercise.mapper';
import type { SkillTag } from '../src/contract/skills';

const BACKEND_ROOT = join(__dirname, '..');
const SEED_FILE = join(BACKEND_ROOT, 'item_bank.seed.json');
const OUT_FILE = join(BACKEND_ROOT, 'item_bank.generated.json');

type Lex = {
  lemma: string;
  hk: number;
  pos: string;
  genus: string | null;
  syllabification: string;
  syllableCount: number;
  familyStem: string | null;
  compoundParts: string[];
  skillTags: string[];
  features: Record<string, unknown>;
};

/** An item_bank row as stored in item_bank.seed.json (see prisma/seed.ts). */
interface Row {
  seed_key: string;
  unit: number;
  exercise_type: string;
  payload: Record<string, unknown>;
  skill_tags: string[];
  difficulty: number;
  audio_url: null;
  syllable_audio: null;
  generated_by: string;
}

// ── deterministic RNG so re-runs are byte-stable (no churn in the candidates file) ──
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffle that avoids returning the input order, so tile-order exercises aren't emitted pre-solved. */
function shuffleDistinct<T>(arr: readonly T[], rng: () => number): T[] {
  if (arr.length < 2) return [...arr];
  const original = JSON.stringify(arr);
  for (let i = 0; i < 8; i++) {
    const out = shuffle(arr, rng); // rng is stateful, so each retry advances it → a different draw
    if (JSON.stringify(out) !== original) return out;
  }
  // Deterministic fallback: rotate by one — guaranteed distinct unless every tile is identical.
  const rotated = [...arr.slice(1), arr[0]];
  return JSON.stringify(rotated) !== original ? rotated : [...arr];
}

// Transliterate umlauts/ß so diacritics don't collapse to the same slug (fällen ≠ füllen); the caller
// also de-duplicates seed keys, so a residual collision (e.g. leben/Leben) never silently drops a row.
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const difficultyFromHk = (hk: number) => Math.max(1, Math.min(5, Math.round(hk / 3)));
const feat = (l: Lex, key: string) => l.features?.[key] != null && l.features[key] !== false;
// Wortfamilie stems are stored with a trailing dash in item_bank (e.g. "fahr-"); match that convention.
const familyStemLabel = (stem: string) => (stem.endsWith('-') ? stem : `${stem}-`);

type Candidate = { type: string; skill: SkillTag; payload: Record<string, unknown> };
interface Ctx {
  byLemmaCI: Map<string, Lex>; // lemma (lower-cased) → lexeme, for tolerant Grundwort lookup
  familyRep: Map<string, string>; // familyStem → representative lemma (lowest HK) — one exercise per family
  curatedLemmas: { lemma: string; stem: string }[]; // lemmas that HAVE a familyStem (the distractor pool)
}

// ── syllable_segmentation → sylarrange ──
function genSylarrange(l: Lex): Candidate | null {
  const syll = l.syllabification.split('-').filter(Boolean);
  if (syll.length < 2) return null;
  // Seed convention: a noun's FIRST syllable keeps its capital (Gleich·ge·wicht) — the stored
  // syllabification is all-lowercase, so re-case tile 0 from the lemma.
  if (l.lemma[0] === l.lemma[0].toUpperCase()) syll[0] = syll[0][0].toUpperCase() + syll[0].slice(1);
  const tiles = shuffleDistinct(syll, mulberry32(hashStr(l.lemma)));
  if (JSON.stringify(tiles) === JSON.stringify(syll)) return null; // all-identical tiles (e.g. nen-nen) → degenerate
  return {
    type: 'sylarrange',
    skill: 'syllable_segmentation',
    payload: { word: l.lemma, syll, tiles, praise: `Super! ${l.lemma} hat ${syll.length} Silben.` },
  };
}

// ── word_family → family (one exercise per curated family, from its representative member) ──
function genFamily(l: Lex, ctx: Ctx): Candidate | null {
  if (!l.familyStem || ctx.familyRep.get(l.familyStem) !== l.lemma) return null; // emit once, from the rep
  const rng = mulberry32(hashStr(l.familyStem));
  // Distractors ONLY from OTHER curated families — never an untagged word that might be a true relative,
  // which would make the item have two correct answers.
  const pool = ctx.curatedLemmas.filter((x) => x.stem !== l.familyStem).map((x) => x.lemma);
  const distractors = shuffle(pool, rng).slice(0, 3);
  if (distractors.length < 3) return null; // need enough OTHER families to build an unambiguous item
  const bare = l.familyStem.replace(/-$/, '');
  return {
    type: 'family',
    skill: 'word_family',
    payload: {
      stem: familyStemLabel(l.familyStem),
      options: shuffle([l.lemma, ...distractors], rng),
      answer: l.lemma,
      praise: `Richtig! ${l.lemma} gehört zur Wortfamilie „${bare}“.`,
    },
  };
}

// ── compound_word + article → compound (article of the Grundwort, looked up in the pool) ──
function genCompound(l: Lex, ctx: Ctx): Candidate | null {
  if (l.compoundParts.length !== 2) return null;
  const [a, b] = l.compoundParts.map((p) => p.trim());
  if ((a + b).toLowerCase() !== l.lemma.toLowerCase()) return null; // parts must spell the word
  const grund = ctx.byLemmaCI.get(b.toLowerCase()); // case-insensitive so 'treppe' still finds 'Treppe'
  if (!grund?.genus) return null; // need the Grundwort's der/die/das
  return {
    type: 'compound',
    skill: 'compound_word',
    payload: {
      word: l.lemma,
      parts: [a, b],
      options: ['der', 'die', 'das'],
      answer: grund.genus,
      praise: `Genau! „${grund.lemma}“ ist ${grund.genus} — also ${grund.genus} ${l.lemma}.`,
    },
  };
}

// ── double_consonant / dehnung_h → length (best-effort vowel; skips when ambiguous) ──
function genLength(l: Lex): Candidate | null {
  const lw = l.lemma.toLowerCase();
  const isKurz = l.skillTags.includes('double_consonant') || feat(l, 'silbengelenk');
  const isLang = l.skillTags.includes('dehnung_h') || feat(l, 'stummesH') || feat(l, 'silbischesH');
  if (isKurz === isLang) return null; // need exactly one unambiguous signal
  const vowel = isKurz
    ? lw.match(/([aeiouäöü])([bcdfghjklmnpqrstvwxyz])\2/)?.[1] // short vowel before a doubled consonant
    : lw.match(/(ie|ei|au|eu|äu|ai|aa|ee|oo|[aeiouäöü])h/)?.[1]; // long vowel/diphthong before a silent h
  if (!vowel) return null;
  return {
    type: 'length',
    skill: isKurz ? 'double_consonant' : 'dehnung_h',
    payload: {
      word: l.lemma,
      vowel,
      answer: isKurz ? 'kurz' : 'lang',
      hint: isKurz ? 'Doppelkonsonant = Stopper → kurz' : 'Dehnungs-h → lang',
      praise: `Stimmt! Das ${vowel} in ${l.lemma} ist ${isKurz ? 'kurz' : 'lang'}.`,
    },
  };
}

const GENERATORS: ((l: Lex, ctx: Ctx) => Candidate | null)[] = [
  genSylarrange,
  genFamily,
  genCompound,
  genLength,
];

/** Reuse the unit that existing seed items of each type live in (fallback 1). */
function unitByType(): Record<string, number> {
  const { items } = JSON.parse(readFileSync(SEED_FILE, 'utf-8')) as { items: Row[] };
  const tally: Record<string, Map<number, number>> = {};
  for (const r of items) {
    (tally[r.exercise_type] ??= new Map()).set(r.unit, ((tally[r.exercise_type].get(r.unit) ?? 0) + 1));
  }
  return Object.fromEntries(
    Object.entries(tally).map(([t, m]) => [t, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]]),
  );
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL as string) });
  try {
    const lex = (await prisma.lexeme.findMany({
      select: {
        lemma: true, hk: true, pos: true, genus: true, syllabification: true, syllableCount: true,
        familyStem: true, compoundParts: true, skillTags: true, features: true,
      },
    })) as unknown as Lex[];

    const byLemmaCI = new Map(lex.map((l) => [l.lemma.toLowerCase(), l]));
    // Group curated lexemes by family stem, then pick each family's representative (lowest HK) once.
    const byStem = new Map<string, Lex[]>();
    for (const l of lex) {
      if (!l.familyStem) continue;
      let g = byStem.get(l.familyStem);
      if (!g) byStem.set(l.familyStem, (g = []));
      g.push(l);
    }
    const familyRep = new Map<string, string>();
    for (const [stem, members] of byStem) {
      familyRep.set(stem, [...members].sort((a, b) => a.hk - b.hk || a.lemma.localeCompare(b.lemma))[0].lemma);
    }
    const curatedLemmas = lex.filter((l) => l.familyStem).map((l) => ({ lemma: l.lemma, stem: l.familyStem! }));
    const ctx: Ctx = { byLemmaCI, familyRep, curatedLemmas };
    const units = unitByType();

    const rows: Row[] = [];
    const seen = new Set<string>();
    const rejected: { lemma: string; type: string; reason: string }[] = [];
    const perType: Record<string, number> = {};

    for (const l of lex) {
      for (const gen of GENERATORS) {
        const c = gen(l, ctx);
        if (!c) continue;
        // Validate against the SAME guard as seed content, via the SAME assembler the serving path uses
        // (exercise.mapper.toExercise) — so the gate can't drift from what sessions actually render.
        const wire = toExercise({
          id: 'gen',
          exerciseType: c.type,
          payload: c.payload,
          audioUrl: null,
          syllableAudio: null,
          skillTags: [c.skill],
        } as unknown as ItemBankModel);
        const parsed = solvableExerciseSchema.safeParse(wire);
        if (!parsed.success) {
          rejected.push({ lemma: l.lemma, type: c.type, reason: parsed.error.issues[0]?.message ?? 'invalid' });
          continue;
        }
        // Collision-safe seed key: distinct lemmas that slug to the same skeleton (leben/Leben) each get a
        // suffix instead of the second being silently dropped by the `seen` set.
        let seedKey = `gen-${c.type}-${slug(l.lemma)}`;
        if (seen.has(seedKey)) {
          let n = 2;
          while (seen.has(`${seedKey}-${n}`)) n++;
          seedKey = `${seedKey}-${n}`;
        }
        seen.add(seedKey);
        rows.push({
          seed_key: seedKey,
          unit: units[c.type] ?? 1,
          exercise_type: c.type,
          payload: c.payload,
          skill_tags: [c.skill],
          difficulty: difficultyFromHk(l.hk),
          audio_url: null,
          syllable_audio: null,
          generated_by: 'seed',
        });
        perType[c.type] = (perType[c.type] ?? 0) + 1;
      }
    }

    rows.sort((a, b) => a.seed_key.localeCompare(b.seed_key));
    writeFileSync(OUT_FILE, JSON.stringify(rows, null, 1) + '\n');

    console.log(`\ngenerated ${rows.length} candidate items → ${OUT_FILE}`);
    for (const [t, n] of Object.entries(perType).sort((a, b) => b[1] - a[1])) console.log(`  ${t.padEnd(12)} ${n}`);
    if (rejected.length) console.log(`\n${rejected.length} rejected by solvability (not emitted). First few:`, rejected.slice(0, 5));
    console.log('\nReview item_bank.generated.json, then copy the good rows into item_bank.seed.json.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
