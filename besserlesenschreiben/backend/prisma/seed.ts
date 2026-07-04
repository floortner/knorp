/**
 * prisma/seed.ts — load item_bank.seed.json into the item_bank table (idempotent).
 *
 * Wire up in package.json:
 *   "prisma": { "seed": "tsx prisma/seed.ts" }
 * then run:  npm run seed   (or: npx prisma db seed)
 *
 * Re-run safely any time the seed JSON changes — upserts on `seed_key`.
 *
 * PREREQUISITE: the Prisma `ItemBank` model needs a unique natural key so re-seeding is idempotent:
 *
 *   model ItemBank {
 *     id            String  @id @default(uuid())
 *     seedKey       String? @unique @map("seed_key")
 *     unit          Int
 *     exerciseType  String  @map("exercise_type")
 *     payload       Json
 *     skillTags     String[] @map("skill_tags")
 *     difficulty    Int     @default(1)
 *     audioUrl      String? @map("audio_url")
 *     syllableAudio Json?   @map("syllable_audio")
 *     generatedBy   String  @default("seed") @map("generated_by")
 *     createdAt     DateTime @default(now()) @map("created_at")
 *     @@map("item_bank")
 *   }
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { LEXEME_OVERRIDE_FIELDS } from "../src/services/lexeme/overrides.util";
import { SKILL_TAG_SET } from "../src/contract/skills";
import { EXERCISE_TYPES } from "../src/contract/exercise";

const adapter = new PrismaPg(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter });

interface SeedItem {
  seed_key: string;
  unit: number;
  exercise_type: string;
  payload: unknown;
  skill_tags: string[];
  difficulty: number;
  audio_url: string | null;
  syllable_audio: unknown | null;
  generated_by: string;
}

interface LexemeSeed {
  lemma: string;
  hk: number;
  pos: string;
  genus: string | null;
  morphemeCount: number;
  ipa: string;
  syllabification: string;
  syllableCount: number;
  forms: string | null;
  separablePrefix: string | null;
  familyStem: string | null;
  compoundParts: string[];
  features: Record<string, unknown>;
  skillTags: string[];
  isLernwort: boolean;
  isTrennbar: boolean;
  isMerkwort: boolean;
  source: string;
}

/** Committed corrections layered on the base (lexeme.overrides.json). See that file's _comment. */
interface LexemeOverrides {
  edits?: Record<string, Record<string, unknown>>; // lemma → sparse field patch (field-level)
  adds?: LexemeSeed[]; // new words not in the base
  deletes?: string[]; // base lemmas to remove
}

// Fields a correction may patch — never id/lemma/createdAt/source. Single source of truth, shared with
// the exporter (computeOverrides), so adding a column can't silently drop it from the overrides apply.
const LEXEME_EDITABLE = new Set<string>(LEXEME_OVERRIDE_FIELDS);

/** Map a seed/override record to the Prisma write payload (shared by base upsert + overrides adds). */
function lexemeData(r: LexemeSeed) {
  return {
    hk: r.hk,
    pos: r.pos,
    genus: r.genus ?? null,
    morphemeCount: r.morphemeCount,
    ipa: r.ipa,
    syllabification: r.syllabification,
    syllableCount: r.syllableCount,
    forms: r.forms ?? null,
    separablePrefix: r.separablePrefix ?? null,
    familyStem: r.familyStem ?? null,
    compoundParts: r.compoundParts ?? [],
    features: (r.features ?? {}) as Prisma.InputJsonValue,
    skillTags: r.skillTags ?? [],
    isLernwort: r.isLernwort,
    isTrennbar: r.isTrennbar,
    isMerkwort: r.isMerkwort,
    source: r.source ?? "rwe2015",
  };
}

/** Fail-fast drift guard: every skill tag must be in the taxonomy (src/contract/skills.ts). */
function assertKnownTags(tags: string[] | undefined, where: string): void {
  const bad = (tags ?? []).filter((t) => !SKILL_TAG_SET.has(t));
  if (bad.length) throw new Error(`Unknown skill tags in ${where}: ${bad.map((t) => `"${t}"`).join(", ")}`);
}

async function main(): Promise<void> {
  const file = join(__dirname, "..", "item_bank.seed.json");
  const { items } = JSON.parse(readFileSync(file, "utf-8")) as { items: SeedItem[] };

  // Fail fast on skill-tag drift: every seeded tag must be in the taxonomy (src/contract/skills.ts),
  // otherwise FSRS scheduling / digest / LLM targeting would silently ignore it.
  const badTags = items.flatMap((row) =>
    (row.skill_tags ?? []).filter((t) => !SKILL_TAG_SET.has(t)).map((t) => `${row.seed_key}: "${t}"`),
  );
  if (badTags.length) {
    throw new Error(`Unknown skill tags in seed (not in taxonomy):\n  ${badTags.join("\n  ")}`);
  }

  let inserted = 0;
  let updated = 0;

  for (const row of items) {
    const existing = await prisma.itemBank.findUnique({ where: { seedKey: row.seed_key } });

    // Core fields. On UPDATE we deliberately omit audio fields when the seed has none,
    // so we never clobber audio already synthesized by the TTS pipeline.
    const base = {
      seedKey: row.seed_key,
      unit: row.unit,
      exerciseType: row.exercise_type,
      payload: row.payload as object,
      skillTags: row.skill_tags,
      difficulty: row.difficulty,
      generatedBy: row.generated_by ?? "seed",
    };

    if (existing) {
      await prisma.itemBank.update({
        where: { seedKey: row.seed_key },
        data: {
          ...base,
          ...(row.audio_url ? { audioUrl: row.audio_url } : {}),
          ...(row.syllable_audio ? { syllableAudio: row.syllable_audio as object } : {}),
        },
      });
      updated++;
    } else {
      await prisma.itemBank.create({
        data: {
          ...base,
          audioUrl: row.audio_url ?? null,
          ...(row.syllable_audio ? { syllableAudio: row.syllable_audio as object } : {}),
        },
      });
      inserted++;
    }
  }

  console.log(`item_bank seeded: ${inserted} inserted, ${updated} updated, ${items.length} total`);

  // Prune content that no longer exists in the program. Two cases, handled differently because
  // `attempt.item` is an optional relation (SetNull on delete): deleting a referenced item nulls those
  // attempts' item_id and collapses them onto the sentinel in the functional unique index
  // `(session_id, COALESCE(item_id, …), attempt_no)` → P2002.
  //
  // 1. Off-contract TYPES (e.g. the pre-refactor taxonomy) are unrenderable AND fail the session response
  //    contract, so they MUST go regardless of history. Delete their attempts first (an attempt on a type
  //    the program no longer has is defunct), then the rows — no SetNull, no collision.
  const offContractIds = (
    await prisma.itemBank.findMany({
      where: { exerciseType: { notIn: [...EXERCISE_TYPES] } },
      select: { id: true },
    })
  ).map((r) => r.id);
  const prunedAttempts = offContractIds.length
    ? (await prisma.attempt.deleteMany({ where: { itemId: { in: offContractIds } } })).count
    : 0;
  const pruneTypes = await prisma.itemBank.deleteMany({ where: { id: { in: offContractIds } } });

  // 2. Stale SEED rows whose type is still VALID stay renderable — only drop the unreferenced ones so a
  //    routine re-seed never destroys telemetry for content that's still serveable.
  const pruneSeed = await prisma.itemBank.deleteMany({
    where: { generatedBy: "seed", seedKey: { notIn: items.map((r) => r.seed_key) }, attempts: { none: {} } },
  });
  if (pruneSeed.count || pruneTypes.count) {
    console.log(
      `item_bank pruned: ${pruneSeed.count} stale seed rows, ${pruneTypes.count} off-contract rows (+${prunedAttempts} defunct attempts)`,
    );
  }

  // ── Lexeme foundation ──────────────────────────────────────────────────────────────────────────
  // Annotated word pool (Rechtschreibwortschatz 2015) that feeds lecture generation and, later,
  // deterministic bank generation. Idempotent upsert on `lemma`. Same skill-tag drift guard as
  // item_bank — a lexeme tagged with a skill outside the taxonomy would be invisible to lecture targeting.
  const lexemes = JSON.parse(
    readFileSync(join(__dirname, "..", "lexeme.seed.json"), "utf-8"),
  ) as LexemeSeed[];
  lexemes.forEach((r) => assertKnownTags(r.skillTags, `lexeme seed (${r.lemma})`));
  for (const r of lexemes) {
    const data = lexemeData(r);
    await prisma.lexeme.upsert({ where: { lemma: r.lemma }, update: data, create: { lemma: r.lemma, ...data } });
  }
  const baseLemmas = new Set(lexemes.map((r) => r.lemma));

  // Prune base words dropped from lexeme.seed.json (e.g. a re-parse removed them). Only source='rwe2015'
  // rows are candidates — reviewer-added words (source='reviewer') and overrides.adds are never touched.
  // Without this a removed word would linger forever and keep grounding lecture generation.
  const stale = (
    await prisma.lexeme.findMany({ where: { source: "rwe2015" }, select: { lemma: true } })
  )
    .map((r) => r.lemma)
    .filter((lemma) => !baseLemmas.has(lemma));
  if (stale.length) await prisma.lexeme.deleteMany({ where: { lemma: { in: stale } } });
  console.log(`lexeme seeded: ${lexemes.length} upserted, ${stale.length} stale base rows pruned`);

  // ── Corrections overlay ──────────────────────────────────────────────────────────────────────────
  // Applied AFTER the base so human edits win and survive reseeds (lexeme.overrides.json — a committed,
  // git-reviewable change-set regenerated by `npm run export:overrides`). Order: deletes → adds → edits.
  const overrides = JSON.parse(
    readFileSync(join(__dirname, "..", "lexeme.overrides.json"), "utf-8"),
  ) as LexemeOverrides;

  const deletes = overrides.deletes ?? [];
  if (deletes.length) await prisma.lexeme.deleteMany({ where: { lemma: { in: deletes } } });

  const adds = overrides.adds ?? [];
  adds.forEach((r) => assertKnownTags(r.skillTags, `lexeme overrides add (${r.lemma})`));
  let addCount = 0;
  for (const r of adds) {
    // A stale add whose lemma has since been folded into the base is dropped — the base now owns it and
    // must not be overwritten by the (older) committed add. Genuine adds (not in base) upsert normally.
    if (baseLemmas.has(r.lemma)) continue;
    const data = lexemeData({ ...r, source: r.source ?? "reviewer" });
    await prisma.lexeme.upsert({ where: { lemma: r.lemma }, update: data, create: { lemma: r.lemma, ...data } });
    addCount++;
  }

  let editCount = 0;
  for (const [lemma, patch] of Object.entries(overrides.edits ?? {})) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (LEXEME_EDITABLE.has(k)) data[k] = v;
    if (Array.isArray(data.skillTags)) assertKnownTags(data.skillTags as string[], `lexeme override edit (${lemma})`);
    if (!Object.keys(data).length) continue;
    // updateMany is a no-op (count 0) when the base doesn't have this lemma — a stale patch never throws.
    const res = await prisma.lexeme.updateMany({ where: { lemma }, data: data as Prisma.LexemeUpdateManyMutationInput });
    if (res.count) editCount++;
  }
  if (deletes.length || addCount || editCount) {
    console.log(`lexeme overrides applied: ${editCount} edits, ${addCount} adds, ${deletes.length} deletes`);
  }

  // Admin bootstrap (ARCHITECTURE §1b): there is no staff self-signup, so the first admin reviewer must
  // be provisioned here. STAFF_ADMIN_EMAILS (comma-separated) are upserted as active admins, giving the
  // owner an account that can approve/deactivate/delete families. Idempotent; never downgrades an admin.
  const adminEmails = (process.env.STAFF_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  for (const email of adminEmails) {
    await prisma.reviewer.upsert({
      where: { email },
      update: { role: "admin", status: "active" },
      create: { email, name: email.split("@")[0], role: "admin", status: "active" },
    });
  }
  if (adminEmails.length) console.log(`staff admins ensured: ${adminEmails.length}`);

  // ── Local dev convenience accounts (NEVER in production) ─────────────────────────────────────────
  // Seeded ACTIVE so you can log straight into the family app / reviewer portal without the
  // pending→staff-approval flow. Login stays passwordless — request a code, read it from the console.
  // Double-gated: an EXPLICIT SEED_DEV_ACCOUNTS=true opt-in AND NODE_ENV != production. NODE_ENV alone
  // isn't enough — its default is 'development', so a prod seed job that forgets NODE_ENV=production plus
  // a stray DEV_* var could otherwise silently provision a passwordless active account.
  if (process.env.SEED_DEV_ACCOUNTS === "true" && process.env.NODE_ENV !== "production") {
    const devFamily = (process.env.DEV_FAMILY_EMAIL ?? "").trim().toLowerCase();
    if (devFamily) {
      const acct = await prisma.account.upsert({
        where: { email: devFamily },
        update: { status: "active" },
        create: { email: devFamily, status: "active" },
      });
      console.log(`dev family account ensured (active): ${devFamily}`);
      // Ready-made child profile so login lands straight in /app/lernen (skips onboarding). Only when
      // the account has no profile yet — never duplicate on reseed or clobber one you created by hand.
      if ((await prisma.profile.count({ where: { accountId: acct.id } })) === 0) {
        await prisma.profile.create({ data: { accountId: acct.id, name: "Testkind", buddy: "nepo" } });
        console.log(`  ↳ child profile created: Testkind`);
      }
    }
    // Seeded as ADMIN so the whole reviewer portal (review queue + user admin) is testable.
    const devReviewer = (process.env.DEV_REVIEWER_EMAIL ?? "").trim().toLowerCase();
    if (devReviewer) {
      await prisma.reviewer.upsert({
        where: { email: devReviewer },
        update: { role: "admin", status: "active" },
        create: { email: devReviewer, name: devReviewer.split("@")[0], role: "admin", status: "active" },
      });
      console.log(`dev reviewer ensured (active admin): ${devReviewer}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
