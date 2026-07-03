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
    // Disable Nest's built-in JSON body parser so we can register one that tolerates an empty body
    // (see below); multipart is registered separately via @fastify/multipart.
    { bufferLogs: true, bodyParser: false },
  );

  // Fastify's built-in JSON parser 400s on an empty body sent with `content-type: application/json`
  // ("Body cannot be empty…"). Our clients set that header on every request, incl. bodyless POSTs
  // (/sessions/:id/complete, /auth/logout, /parent/*), so an empty body must mean "no body", not a 400.
  // Non-empty bodies parse as before; malformed JSON still 400s.
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body: string, done) => {
    if (body === '' || body == null) return done(null, {});
    try {
      done(null, JSON.parse(body));
    } catch {
      const err = new Error('Invalid JSON body') as Error & { statusCode?: number };
      err.statusCode = 400;
      done(err, undefined);
    }
  });

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
