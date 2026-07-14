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
    // trustProxy: in prod the app sits behind nginx (TLS termination) — derive the client IP from
    // X-Forwarded-For so per-IP rate limiting sees the real caller, not 127.0.0.1 (which would hand every
    // request the loopback exemption below). Harmless in dev/e2e: no XFF header → req.ip stays the socket IP.
    new FastifyAdapter({ trustProxy: true }),
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
  // CORS (ARCHITECTURE §4): production allows ONLY the configured origins — credentialed CORS must never
  // reflect arbitrary origins. Dev/test stay permissive so localhost ports work without ceremony.
  const allowedOrigins = [process.env.WEB_ORIGIN, process.env.REVIEWER_ORIGIN]
    .flatMap((v) => (v ?? '').split(','))
    .map((s) => s.trim())
    .filter(Boolean);
  if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
    throw new Error('CORS allowlist is empty: set WEB_ORIGIN (and REVIEWER_ORIGIN) in production (ARCHITECTURE §4).');
  }
  // @fastify/cors defaults Access-Control-Allow-Methods to GET,HEAD,POST only (unlike the Express `cors`
  // package), which silently blocks every cross-origin PATCH/PUT/DELETE preflight — enumerate them.
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });
  // Request-level rate limiting (per IP): tight on the auth/code endpoints (email-sending cost +
  // brute-force surface), loose elsewhere. Domain-level counters (verify attempts, PIN lockout, daily
  // ★ caps) remain the precise guards — this is the blunt outer shell. Emits the §5 error envelope.
  // Loopback addresses are skipped so e2e tests (all traffic from 127.0.0.1) are not throttled.
  const { default: fastifyRateLimit } = await import('@fastify/rate-limit');
  const isProd = process.env.NODE_ENV === 'production';
  await app.register(fastifyRateLimit, {
    timeWindow: '1 minute',
    // The loopback exemption exists only so the e2e suite (all traffic from 127.0.0.1) isn't throttled;
    // it must never apply in production, where a request that reaches the app as loopback (direct :3000
    // hit + spoofed XFF) would otherwise dodge all auth rate limiting (security review P2-6).
    allowList: (req: { ip?: string }) => !isProd && (req.ip === '127.0.0.1' || req.ip === '::1'),
    max: (req: { url?: string }) => ((req.url ?? '').includes('/auth/') ? 10 : 300),
    errorResponseBuilder: (req: { id?: string }, context: { after: string }) => ({
      error: {
        code: 'RATE_LIMITED',
        message: `Zu viele Anfragen. Bitte warte ${context.after}.`,
        requestId: String(req.id ?? ''),
        details: [],
      },
    }),
  });
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
  // In prod the app sits behind nginx on the same box — bind loopback only so nothing but nginx can reach
  // it, even if the security group is ever misconfigured (defence-in-depth, security review P2-6). Dev/e2e
  // bind all interfaces so the app is reachable from the host/other containers. Override via HOST.
  const host = process.env.HOST ?? (isProd ? '127.0.0.1' : '0.0.0.0');
  await app.listen({ port, host });
}

void bootstrap();
