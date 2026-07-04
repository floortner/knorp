import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { ApiException } from '../../common/exceptions/api-exception';
import { SKILL_TAG_SET } from '../../contract/skills';
import { computeOverrides, overridesFile, type LexemeRecord } from '../../services/lexeme/overrides.util';
import type { Env } from '../../config/env';
import type { LexemeCreateInput, LexemeEditInput } from './staff.dto';

const MAX_LIMIT = 200;
// Resolve the repo-checkout data files relative to THIS module (backend root), not process.cwd() —
// robust to the launch directory and consistent with prisma/seed.ts + scripts/export-overrides.ts.
// __dirname is <backend>/src/modules/staff (dev) or <backend>/dist/modules/staff (built) → up 3 = backend.
const BACKEND_ROOT = join(__dirname, '..', '..', '..');
const BASE_FILE = join(BACKEND_ROOT, 'lexeme.seed.json');
const OVERRIDES_FILE = join(BACKEND_ROOT, 'lexeme.overrides.json');

type LexemeRow = Prisma.LexemeGetPayload<Record<string, never>>;

/** Wire shape (contract/staff.ts `lexemeSchema`) — drops id/createdAt. */
function toWire(r: LexemeRow) {
  return {
    lemma: r.lemma,
    hk: r.hk,
    pos: r.pos,
    genus: r.genus,
    morphemeCount: r.morphemeCount,
    ipa: r.ipa,
    syllabification: r.syllabification,
    syllableCount: r.syllableCount,
    forms: r.forms,
    separablePrefix: r.separablePrefix,
    features: (r.features ?? {}) as Record<string, string | boolean>,
    skillTags: r.skillTags,
    isLernwort: r.isLernwort,
    isTrennbar: r.isTrennbar,
    isMerkwort: r.isMerkwort,
    source: r.source,
  };
}

/** Full-property filter for the browser + the stats aggregate (shared `where`). */
export interface LexemeFilters {
  search?: string; // lemma contains (case-insensitive)
  skill?: string; // skillTags has
  pos?: string; // exact part of speech
  genus?: string; // 'der' | 'die' | 'das' | 'none' (none → no genus, i.e. not a noun)
  source?: string; // 'rwe2015' | 'reviewer'
  feature?: string; // an orthographic feature key that must be present in `features`
  hkMin?: number;
  hkMax?: number;
  lernwort?: boolean;
  trennbar?: boolean;
  merkwort?: boolean;
}

function whereFrom(f: LexemeFilters): Prisma.LexemeWhereInput {
  const w: Prisma.LexemeWhereInput = {};
  if (f.search) w.lemma = { contains: f.search, mode: 'insensitive' };
  if (f.skill) w.skillTags = { has: f.skill };
  if (f.pos) w.pos = f.pos;
  if (f.genus) w.genus = f.genus === 'none' ? null : f.genus;
  if (f.source) w.source = f.source;
  if (f.lernwort !== undefined) w.isLernwort = f.lernwort;
  if (f.trennbar !== undefined) w.isTrennbar = f.trennbar;
  if (f.merkwort !== undefined) w.isMerkwort = f.merkwort;
  if (f.hkMin !== undefined || f.hkMax !== undefined) {
    w.hk = { ...(f.hkMin !== undefined ? { gte: f.hkMin } : {}), ...(f.hkMax !== undefined ? { lte: f.hkMax } : {}) };
  }
  // "feature present": the value at features->key is not DB-NULL (absent key → NULL → excluded).
  if (f.feature) w.features = { path: [f.feature], not: Prisma.DbNull };
  return w;
}

/**
 * Lexeme foundation CURATION (STAFF realm, ADMIN role; SPEC §6). Edits the annotated word pool that
 * grounds lecture generation. Writes land in the live `lexeme` table for immediate effect; `export()`
 * diffs the table against the PDF-extracted base and (re)writes the committed lexeme.overrides.json so
 * corrections survive reseeds and reproduce in any fresh DB (the durability model the reviewer curates in).
 */
@Injectable()
export class LexemeAdminService {
  private readonly logger = new Logger('LexemeAdminService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Full-property filter + search, ordered by lemma, cursor-paged; with a total count. */
  async list(opts: LexemeFilters & { limit: number; cursor?: string }) {
    const take = Math.min(Math.max(opts.limit, 1), MAX_LIMIT);
    const where = whereFrom(opts);
    const [rows, total] = await Promise.all([
      this.prisma.lexeme.findMany({
        where,
        orderBy: { lemma: 'asc' },
        take: take + 1,
        ...(opts.cursor ? { cursor: { lemma: opts.cursor }, skip: 1 } : {}),
      }),
      this.prisma.lexeme.count({ where }),
    ]);
    const page = rows.slice(0, take);
    return {
      items: page.map(toWire),
      nextCursor: rows.length > take ? page[page.length - 1].lemma : null,
      total,
    };
  }

  /**
   * Aggregate stats over the SAME filter (how many words match, broken down by POS/genus/source/skill,
   * the flag counts, and the HK range). Computed in JS from a small projection — this is an admin
   * curation view, not a hot path, so a full scan of the (≤ a few thousand) matching rows is fine.
   */
  async stats(f: LexemeFilters) {
    const rows = await this.prisma.lexeme.findMany({
      where: whereFrom(f),
      select: {
        pos: true, genus: true, source: true, hk: true, skillTags: true,
        isLernwort: true, isTrennbar: true, isMerkwort: true,
      },
    });
    const total = rows.length;
    const tally = (vals: (string | null)[]) => {
      const m = new Map<string, number>();
      for (const v of vals) m.set(v ?? '—', (m.get(v ?? '—') ?? 0) + 1);
      return [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
    };
    const skill = new Map<string, number>();
    for (const r of rows) for (const t of r.skillTags) skill.set(t, (skill.get(t) ?? 0) + 1);
    const hks = rows.map((r) => r.hk);
    return {
      total,
      byPos: tally(rows.map((r) => r.pos)),
      byGenus: tally(rows.map((r) => r.genus)),
      bySource: tally(rows.map((r) => r.source)),
      bySkill: [...skill.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
      flags: {
        lernwort: rows.filter((r) => r.isLernwort).length,
        trennbar: rows.filter((r) => r.isTrennbar).length,
        merkwort: rows.filter((r) => r.isMerkwort).length,
      },
      hk: total
        ? {
            min: Math.min(...hks),
            max: Math.max(...hks),
            avg: Math.round((hks.reduce((a, b) => a + b, 0) / total) * 10) / 10,
          }
        : { min: 0, max: 0, avg: 0 },
    };
  }

  async get(lemma: string) {
    return toWire(await this.require(lemma));
  }

  /** Field-level edit (only the provided fields change). */
  async edit(lemma: string, patch: LexemeEditInput) {
    await this.require(lemma);
    if (patch.skillTags) this.assertTags(patch.skillTags);
    const { features, ...rest } = patch;
    const data: Prisma.LexemeUpdateInput = { ...rest };
    if (features !== undefined) data.features = features as Prisma.InputJsonValue;
    const row = await this.prisma.lexeme.update({ where: { lemma }, data });
    this.logger.log({ event: 'lexeme.edited', lemma, fields: Object.keys(patch) }, 'lexeme edited');
    return toWire(row);
  }

  /** Add a new word (409 if the lemma already exists). */
  async add(input: LexemeCreateInput) {
    this.assertTags(input.skillTags);
    if (await this.prisma.lexeme.findUnique({ where: { lemma: input.lemma }, select: { lemma: true } })) {
      throw new ApiException(409, 'CONFLICT', `Das Wort „${input.lemma}“ existiert bereits.`);
    }
    const { features, ...rest } = input;
    const row = await this.prisma.lexeme.create({
      data: { ...rest, features: (features ?? {}) as Prisma.InputJsonValue, source: 'reviewer' },
    });
    this.logger.log({ event: 'lexeme.added', lemma: input.lemma }, 'lexeme added');
    return toWire(row);
  }

  async remove(lemma: string): Promise<void> {
    await this.require(lemma);
    await this.prisma.lexeme.delete({ where: { lemma } });
    this.logger.log({ event: 'lexeme.deleted', lemma }, 'lexeme deleted');
  }

  /**
   * Export the current corrections to the committed lexeme.overrides.json (dev/curation). Diffs the live
   * table against the base seed; the file write is skipped in production (read-only FS), but the counts
   * are always returned.
   */
  async export() {
    // Curation persists to the committed lexeme.overrides.json in the repo checkout — a dev/local
    // activity. In production the file isn't writable (and may not be shipped), so refuse honestly
    // rather than read the base, no-op the write, and return misleading counts.
    if (this.config.get('NODE_ENV', { infer: true }) === 'production') {
      throw new ApiException(
        400,
        'NOT_AVAILABLE',
        'Der Export ist nur in der Entwicklungsumgebung möglich (die Korrekturdatei liegt im Repo-Checkout).',
      );
    }
    const base = JSON.parse(readFileSync(BASE_FILE, 'utf-8')) as LexemeRecord[];
    const rows = (await this.prisma.lexeme.findMany({ orderBy: { lemma: 'asc' } })) as unknown as LexemeRecord[];
    const overrides = computeOverrides(base, rows);
    writeFileSync(OVERRIDES_FILE, JSON.stringify(overridesFile(overrides), null, 2) + '\n');
    const counts = {
      edits: Object.keys(overrides.edits).length,
      adds: overrides.adds.length,
      deletes: overrides.deletes.length,
    };
    this.logger.log({ event: 'lexeme.overrides_exported', ...counts }, 'overrides written');
    return counts;
  }

  private assertTags(tags: string[]): void {
    const bad = tags.filter((t) => !SKILL_TAG_SET.has(t));
    if (bad.length) {
      throw new ApiException(400, 'VALIDATION', `Unbekannte Skill-Tags: ${bad.join(', ')}`);
    }
  }

  private async require(lemma: string): Promise<LexemeRow> {
    const row = await this.prisma.lexeme.findUnique({ where: { lemma } });
    if (!row) throw new ApiException(404, 'NOT_FOUND', 'Wort nicht gefunden.');
    return row;
  }
}
