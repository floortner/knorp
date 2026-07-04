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

  /** Search (lemma contains) + optional skill filter, ordered by lemma, cursor-paged; with a total count. */
  async list(opts: { search?: string; skill?: string; limit: number; cursor?: string }) {
    const take = Math.min(Math.max(opts.limit, 1), MAX_LIMIT);
    const where: Prisma.LexemeWhereInput = {
      ...(opts.search ? { lemma: { contains: opts.search, mode: 'insensitive' } } : {}),
      ...(opts.skill ? { skillTags: { has: opts.skill } } : {}),
    };
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
