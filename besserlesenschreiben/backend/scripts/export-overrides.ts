/**
 * scripts/export-overrides.ts — regenerate lexeme.overrides.json from the live DB.
 *
 *   npm run export:overrides            (needs DATABASE_URL)
 *
 * Diffs the current `lexeme` table against the base `lexeme.seed.json` and writes the minimal
 * change-set. Commit the result — corrections then reproduce in any fresh DB and are reviewable in the
 * PR. Curate via the reviewer portal (or SQL), then run this. Shares the diff logic with the reviewer
 * "export corrections" endpoint (src/services/lexeme/overrides.util.ts).
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { computeOverrides, overridesFile, type LexemeRecord } from '../src/services/lexeme/overrides.util';

const BASE = join(__dirname, '..', 'lexeme.seed.json');
const OUT = process.argv[2] ?? join(__dirname, '..', 'lexeme.overrides.json');

async function main(): Promise<void> {
  const base = JSON.parse(readFileSync(BASE, 'utf-8')) as LexemeRecord[];
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL as string) });
  const rows = (await prisma.lexeme.findMany({ orderBy: { lemma: 'asc' } })) as unknown as LexemeRecord[];
  await prisma.$disconnect();

  const overrides = computeOverrides(base, rows);
  writeFileSync(OUT, JSON.stringify(overridesFile(overrides), null, 2) + '\n');
  console.log(
    `overrides exported → ${OUT}: ${Object.keys(overrides.edits).length} edits, ${overrides.adds.length} adds, ${overrides.deletes.length} deletes`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
