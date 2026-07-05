import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiZodBody, ApiZodResponse } from '../../common/zod-openapi';
import { lexemeExportResultSchema, lexemePageSchema, lexemeSchema, lexemeStatsSchema } from '../../contract/staff';
import { StaffAuthGuard } from '../../common/guards/staff-auth.guard';
import { StaffAdminGuard } from '../../common/guards/staff-admin.guard';
import { LexemeAdminService, type LexemeFilters } from './lexeme-admin.service';
import { LexemeCreateDto, LexemeEditDto } from './staff.dto';

type RawQuery = Record<string, string | undefined>;

/** Parse the raw query strings into typed filters — shared by the list + stats endpoints. */
function toFilters(q: RawQuery): LexemeFilters {
  const bool = (v?: string) => (v === 'true' ? true : v === 'false' ? false : undefined);
  const int = (v?: string) => {
    const n = v ? Number.parseInt(v, 10) : NaN;
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    search: q.search || undefined,
    skill: q.skill || undefined,
    pos: q.pos || undefined,
    genus: q.genus || undefined,
    ageBand: q.ageBand || undefined,
    source: q.source || undefined,
    feature: q.feature || undefined,
    hkMin: int(q.hkMin),
    hkMax: int(q.hkMax),
    syllableCount: int(q.syl),
    morphemeCount: int(q.morph),
    lernwort: bool(q.lernwort),
    trennbar: bool(q.trennbar),
    merkwort: bool(q.merkwort),
  };
}

/**
 * Lexeme foundation CURATION (STAFF realm, ADMIN role). `@Public()` skips the family JwtAuthGuard; then
 * StaffAuthGuard + StaffAdminGuard require an admin reviewer. Edits land in the live table for immediate
 * effect and are persisted to the committed lexeme.overrides.json via /export (SPEC §6).
 */
@Public()
@UseGuards(StaffAuthGuard, StaffAdminGuard)
@ApiTags('staff')
@Controller('staff/lexemes')
export class StaffLexemesController {
  constructor(private readonly lexemes: LexemeAdminService) {}

  @Get()
  @ApiZodResponse(lexemePageSchema)
  list(@Query() q: RawQuery) {
    const n = q.limit ? Number.parseInt(q.limit, 10) : 50;
    return this.lexemes.list({ ...toFilters(q), limit: Number.isFinite(n) ? n : 50, cursor: q.cursor });
  }

  // Static routes must precede :lemma so "stats"/"export" aren't captured as a lemma.
  @Get('stats')
  @ApiZodResponse(lexemeStatsSchema)
  stats(@Query() q: RawQuery) {
    return this.lexemes.stats(toFilters(q));
  }

  @Post('export')
  @HttpCode(200)
  @ApiZodResponse(lexemeExportResultSchema)
  export() {
    return this.lexemes.export();
  }

  @Get(':lemma')
  @ApiZodResponse(lexemeSchema)
  get(@Param('lemma') lemma: string) {
    return this.lexemes.get(lemma);
  }

  @Post()
  @HttpCode(201)
  @ApiZodBody(LexemeCreateDto.schema)
  @ApiZodResponse(lexemeSchema)
  add(@Body() dto: LexemeCreateDto) {
    return this.lexemes.add(dto);
  }

  @Patch(':lemma')
  @ApiZodBody(LexemeEditDto.schema)
  @ApiZodResponse(lexemeSchema)
  edit(@Param('lemma') lemma: string, @Body() dto: LexemeEditDto) {
    return this.lexemes.edit(lemma, dto);
  }

  @Delete(':lemma')
  @HttpCode(204)
  remove(@Param('lemma') lemma: string) {
    return this.lexemes.remove(lemma);
  }
}
