import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { Public } from '../../common/decorators/public.decorator';
import { StorageService } from './storage.service';

/**
 * Serves stored homework images over HTTP for the reviewer portal in the filesystem-store setup (no Azure
 * SAS). The `token` query param is a short-lived signed capability (verified in StorageService) — it IS the
 * auth, so the route is @Public() and a cross-origin <img> needs no cookie. On Azure the queue hands out SAS
 * URLs and this route is never hit. Binary response (no @ApiZodResponse → the response interceptor skips it).
 */
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @ApiExcludeEndpoint() // binary capability URL, not part of the typed JSON contract — keep it out of OpenAPI
  @Get('homework-image')
  @Header('Cache-Control', 'private, max-age=300')
  async homeworkImage(@Query('token') token: string, @Res() reply: FastifyReply): Promise<void> {
    const key = token ? this.storage.verifyHomeworkImageToken(token) : null;
    if (!key) {
      reply.status(404).send();
      return;
    }
    try {
      const bytes = await this.storage.readBinary(key);
      reply.type('image/webp').send(bytes);
    } catch {
      reply.status(404).send();
    }
  }
}
