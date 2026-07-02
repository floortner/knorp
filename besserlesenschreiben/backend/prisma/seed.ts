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
import { PrismaClient } from "../src/generated/prisma/client";
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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
