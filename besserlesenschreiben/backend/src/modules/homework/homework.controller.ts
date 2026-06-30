import { Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { CurrentAccount, type AuthAccount } from '../../common/decorators/current-account.decorator';
import { ApiZodCreatedResponse, ApiZodResponse } from '../../common/zod-openapi';
import { homeworkResultSchema, homeworkUploadResponseSchema } from '../../contract/models';
import { ApiException } from '../../common/exceptions/api-exception';
import { HomeworkService } from './homework.service';

/**
 * Homework upload (family realm, free ★). `POST /homework` is multipart (image + profileId field); the
 * heavy lifting (EXIF strip / WebP / vision draft / enqueue) is in HomeworkService. `GET /homework/:id`
 * returns only the authoritative result (never the LLM draft). profileId/ownership come from the JWT.
 */
@ApiTags('homework')
@ApiBearerAuth()
@Controller()
export class HomeworkController {
  constructor(private readonly homework: HomeworkService) {}

  @Post('homework')
  @HttpCode(201)
  @ApiConsumes('multipart/form-data')
  @ApiZodCreatedResponse(homeworkUploadResponseSchema)
  async upload(@CurrentAccount() account: AuthAccount, @Req() req: FastifyRequest) {
    const data = await req.file(); // from @fastify/multipart (registered in main.ts)
    if (!data) throw new ApiException(422, 'VALIDATION_ERROR', 'Kein Bild empfangen.');
    // profileId is a non-file form field; @fastify/multipart exposes it as { value } on data.fields.
    const profileField = data.fields?.profileId as { value?: string } | undefined;
    const profileId = profileField?.value;
    if (!profileId) throw new ApiException(422, 'VALIDATION_ERROR', 'profileId fehlt.');

    let buffer: Buffer;
    try {
      buffer = await data.toBuffer(); // throws if over the 10 MB multipart limit
    } catch {
      throw new ApiException(422, 'VALIDATION_ERROR', 'Bild zu groß (max. 10 MB).');
    }
    return this.homework.upload(account.id, profileId, { buffer, mimetype: data.mimetype });
  }

  @Get('homework/:id')
  @ApiZodResponse(homeworkResultSchema)
  result(@CurrentAccount() account: AuthAccount, @Param('id') id: string) {
    return this.homework.result(account.id, id);
  }
}
