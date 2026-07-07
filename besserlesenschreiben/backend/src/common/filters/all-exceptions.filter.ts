import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiErrorDetail } from '../exceptions/api-exception';

/** Default code per HTTP status when an exception doesn't carry an explicit one (ARCHITECTURE §5). */
const STATUS_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  402: 'INSUFFICIENT_CREDITS',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
};

/** 5xx codes that are intentional + safe to surface to the client (their messages carry no internals). */
const SAFE_5XX_CODES = new Set<string>(['PROVIDER_UNAVAILABLE']);

/** Diagnostic fields worth logging from an unknown thrown object (curated — never the whole object,
 *  which could embed request payloads/PII; ARCHITECTURE §6). */
const THROWN_FIELDS = ['name', 'message', 'code', 'statusCode', 'status', 'errno', 'syscall', 'reason'] as const;

/**
 * Render an unknown thrown value diagnosably. Beta launch night: a plain-object throw was logged as
 * "[object Object]", turning a debuggable failure into a mystery — never again. Errors keep their
 * stack; objects yield constructor + curated fields + their key names (names only, no values).
 */
function describeThrown(exception: unknown): string {
  if (exception instanceof Error) return exception.stack ?? `${exception.name}: ${exception.message}`;
  if (typeof exception === 'object' && exception !== null) {
    const obj = exception as Record<string, unknown>;
    const ctor = obj.constructor?.name ?? 'Object';
    const picked = THROWN_FIELDS.flatMap((f) => (obj[f] !== undefined ? [`${f}=${String(obj[f])}`] : []));
    const keys = Object.keys(obj).slice(0, 15).join(',');
    return `[${ctor}] ${picked.join(' ')} keys=[${keys}]`.slice(0, 2000);
  }
  return String(exception);
}

/**
 * The ONE error envelope for every non-2xx response (ARCHITECTURE §5):
 *   { error: { code, message, requestId, details? } }
 * No raw stack traces, Prisma errors, or provider errors ever reach the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<FastifyRequest>();
    const res = ctx.getResponse<FastifyReply>();
    const requestId = (req as { id?: string }).id ?? randomUUID();

    let status = 500;
    let code = 'INTERNAL';
    let message = 'Etwas ist schiefgelaufen.';
    let details: ApiErrorDetail[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse() as
        | string
        | { code?: string; message?: string; details?: ApiErrorDetail[] };
      if (typeof resp === 'object' && resp.code) {
        code = resp.code;
        message = resp.message ?? message;
        details = resp.details;
      } else {
        code = STATUS_CODE[status] ?? 'INTERNAL';
        message = typeof resp === 'string' ? resp : (resp.message ?? exception.message);
      }
    } else {
      this.logger.error({ requestId, err: describeThrown(exception) }, 'Unhandled exception');
    }

    // Never leak internals on a 5xx — EXCEPT a small allowlist of intentional, safe-to-surface codes
    // (e.g. PROVIDER_UNAVAILABLE for an AI/TTS outage, which the client acts on; ARCHITECTURE §5). Their
    // messages are author-written, not provider/stack text, so they carry nothing sensitive.
    if (status >= 500 && !SAFE_5XX_CODES.has(code)) {
      code = 'INTERNAL';
      message = 'Etwas ist schiefgelaufen.';
      details = undefined;
    }

    void res
      .header('X-Request-Id', requestId)
      .status(status)
      .send({ error: { code, message, requestId, ...(details ? { details } : {}) } });
  }
}
