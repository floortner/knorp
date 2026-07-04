import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiZodBody, ApiZodResponse } from '../../common/zod-openapi';
import { lexemeExportResultSchema, lexemePageSchema, lexemeSchema } from '../../contract/staff';
import { StaffAuthGuard } from '../../common/guards/staff-auth.guard';
import { StaffAdminGuard } from '../../common/guards/staff-admin.guard';
import { LexemeAdminService } from './lexeme-admin.service';
import { LexemeCreateDto, LexemeEditDto } from './staff.dto';

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
  list(
    @Query('search') search?: string,
    @Query('skill') skill?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const n = limit ? Number.parseInt(limit, 10) : 50;
    return this.lexemes.list({ search, skill, limit: Number.isFinite(n) ? n : 50, cursor });
  }

  // Export must precede :lemma so "/export" isn't captured as a lemma.
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
