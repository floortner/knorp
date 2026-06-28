/**
 * Export the OpenAPI document to `openapi.json` (committed) so the frontend can regenerate its types
 * (`npm run gen:api`) without a running server. Uses Nest preview mode — routes/decorators are scanned
 * statically, so no database or real env is needed.
 */
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Dummy values so the Zod env schema passes during the static scan (no services are instantiated).
// Set BEFORE importing AppModule (whose ConfigModule.forRoot validates env at module-eval time).
process.env.DATABASE_URL ??= 'postgresql://export:export@localhost:5432/export';
process.env.JWT_SECRET ??= 'export-only-secret';

async function main(): Promise<void> {
  const { AppModule } = await import('../src/app.module');
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    preview: true,
    logger: ['error', 'warn'],
  });
  app.setGlobalPrefix('api/v1');
  const config = new DocumentBuilder()
    .setTitle('besserlesenschreiben API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  const out = join(__dirname, '..', 'openapi.json');
  writeFileSync(out, JSON.stringify(document, null, 2) + '\n');
  await app.close();
  console.log(`wrote ${out} (${Object.keys(document.paths).length} paths)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
