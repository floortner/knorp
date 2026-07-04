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
import { solvableExerciseSchema } from '../src/contract/exercise';
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

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const difficultyFromHk = (hk: number) => Math.max(1, Math.min(5, Math.round(hk / 3)));
const feat = (l: Lex, key: string) => l.features?.[key] != null && l.features[key] !== false;

type Candidate = { type: string; skill: SkillTag; payload: Record<string, unknown> };
interface Ctx {
  byLemma: Map<string, Lex>;
  byStem: Map<string, Lex[]>;
  distractors: (stem: string, n: number, rng: () => number) => string[];
}

// ── syllable_segmentation → sylarrange ──
function genSylarrange(l: Lex): Candidate | null {
  const syll = l.syllabification.split('-').filter(Boolean);
  if (syll.length < 2) return null;
  const tiles = shuffle(syll, mulberry32(hashStr(l.lemma)));
  return {
    type: 'sylarrange',
    skill: 'syllable_segmentation',
    payload: { word: l.lemma, syll, tiles, praise: `Super! ${l.lemma} hat ${syll.length} Silben.` },
  };
}

// ── word_family → family (one exercise per curated family; representative = lowest-HK member) ──
function genFamily(l: Lex, ctx: Ctx): Candidate | null {
  if (!l.familyStem) return null;
  const fam = ctx.byStem.get(l.familyStem);
  if (!fam || fam.length < 2) return null; // a real family, not a singleton
  const rep = [...fam].sort((a, b) => a.hk - b.hk || a.lemma.localeCompare(b.lemma))[0];
  if (rep.lemma !== l.lemma) return null; // emit once per family, from the representative
  const rng = mulberry32(hashStr(l.familyStem));
  const distractors = ctx.distractors(l.familyStem, 3, rng); // words from OTHER families (unambiguous)
  if (distractors.length < 3) return null;
  return {
    type: 'family',
    skill: 'word_family',
    payload: {
      stem: l.familyStem,
      options: shuffle([l.lemma, ...distractors], rng),
      answer: l.lemma,
      praise: `Richtig! ${l.lemma} gehört zur Wortfamilie „${l.familyStem}“.`,
    },
  };
}

// ── compound_word + article → compound (article of the Grundwort, looked up in the pool) ──
function genCompound(l: Lex, ctx: Ctx): Candidate | null {
  if (l.compoundParts.length !== 2) return null;
  const [a, b] = l.compoundParts;
  if ((a + b).toLowerCase() !== l.lemma.toLowerCase()) return null; // parts must spell the word
  const grund = ctx.byLemma.get(b);
  if (!grund?.genus) return null; // need the Grundwort's der/die/das
  return {
    type: 'compound',
    skill: 'compound_word',
    payload: {
      word: l.lemma,
      parts: [a, b],
      options: ['der', 'die', 'das'],
      answer: grund.genus,
      praise: `Genau! „${b}“ ist ${grund.genus} — also ${grund.genus} ${l.lemma}.`,
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
    ? lw.match(/([aeiouäöü])([bcdfghjklmnpqrstvwxyz])\2/)?.[1] // vowel before a doubled consonant
    : lw.match(/([aeiouäöü])h/)?.[1]; // vowel before a (silent) h
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
  const seed = JSON.parse(readFileSync(SEED_FILE, 'utf-8')) as { items?: Row[] } | Row[];
  const rows = Array.isArray(seed) ? seed : (seed.items ?? []);
  const tally: Record<string, Map<number, number>> = {};
  for (const r of rows) {
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

    const byLemma = new Map(lex.map((l) => [l.lemma, l]));
    const byStem = new Map<string, Lex[]>();
    for (const l of lex) if (l.familyStem) (byStem.get(l.familyStem) ?? byStem.set(l.familyStem, []).get(l.familyStem)!).push(l);
    const distractors = (stem: string, n: number, rng: () => number) =>
      shuffle(lex.filter((l) => l.familyStem !== stem).map((l) => l.lemma), rng).slice(0, n);
    const ctx: Ctx = { byLemma, byStem, distractors };
    const units = unitByType();

    const rows: Row[] = [];
    const seen = new Set<string>();
    const rejected: { lemma: string; type: string; reason: string }[] = [];
    const perType: Record<string, number> = {};

    for (const l of lex) {
      for (const gen of GENERATORS) {
        const c = gen(l, ctx);
        if (!c) continue;
        // Validate against the SAME guard as seed content — build the full wire Exercise.
        const wire = { type: c.type, ...c.payload, id: 'gen', audioUrl: null, skillTags: [c.skill] };
        const parsed = solvableExerciseSchema.safeParse(wire);
        if (!parsed.success) {
          rejected.push({ lemma: l.lemma, type: c.type, reason: parsed.error.issues[0]?.message ?? 'invalid' });
          continue;
        }
        const seedKey = `gen-${c.type}-${slug(l.lemma)}`;
        if (seen.has(seedKey)) continue;
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
