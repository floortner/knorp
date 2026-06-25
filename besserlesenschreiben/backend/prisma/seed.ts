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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
