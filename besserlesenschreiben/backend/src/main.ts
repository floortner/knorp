import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// NOTE: we validate with a minimal local ZodDto + ZodValidationPipe instead of nestjs-zod (whose
// @nest-zod/z installs a global Zod-3 error map that crashes under Zod 4 — see src/common/zod-dto.ts).
// Trade-off: request/response bodies currently render as bare schemas in OpenAPI. Add per-DTO schema
// metadata (or a Zod↔OpenAPI bridge) before the frontend generates its types from the spec.

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bufferLogs: true },
  );

  app.useLogger(app.get(PinoLogger));
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({ origin: true, credentials: true });
  await app.register(fastifyCookie); // session JWT delivered as an httpOnly cookie (SPEC §4)
  // Homework photo upload (multipart). 10 MB cap, one file per request (SPEC §10 / ARCHITECTURE §10).
  await app.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('besserlesenschreiben API')
    .setDescription('Adaptive German children\'s literacy tutor — backend API (v1).')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/v1/docs', app, document, {
    jsonDocumentUrl: 'api/v1/openapi.json',
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen({ port, host: '0.0.0.0' });
}

void bootstrap();
