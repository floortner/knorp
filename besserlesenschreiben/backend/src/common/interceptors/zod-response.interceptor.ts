import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { map, type Observable } from 'rxjs';
import { ZodObject, type ZodType } from 'zod';
import { ZOD_RESPONSE_KEY } from '../zod-openapi';
import type { Env } from '../../config/env';

/**
 * Validates every 2xx body against the SAME Zod schema published to OpenAPI (via @ApiZodResponse), so
 * the contract the frontend types from can't silently drift from what services actually return.
 *
 * Validation runs on the JSON-roundtripped body (Dates → ISO strings) to match the real wire shape,
 * and returns the parsed value (unknown keys stripped → wire == contract). On a mismatch: throw in
 * non-prod (fail loud in dev/CI); in prod log AND strip to the schema's declared top-level keys —
 * never break a live response, but never ship undeclared fields either (CLAUDE.md "logs+strips").
 */
@Injectable()
export class ZodResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger('ZodResponse');

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<Env, true>,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const schema = this.reflector.get<ZodType | undefined>(ZOD_RESPONSE_KEY, ctx.getHandler());
    if (!schema) return next.handle();
    const strict = this.config.get('NODE_ENV', { infer: true }) !== 'production';

    return next.handle().pipe(
      map((body: unknown) => {
        if (body === undefined) return body;
        const wire: unknown = JSON.parse(JSON.stringify(body));
        const result = schema.safeParse(wire);
        if (result.success) return result.data;

        const { url } = ctx.switchToHttp().getRequest<{ url?: string }>();
        this.logger.error(
          { event: 'contract.response_mismatch', path: url, issues: result.error.issues },
          'response failed its published contract',
        );
        if (strict) throw new Error('Response contract mismatch');
        // prod: don't break the live response — but don't pass undeclared fields through either.
        // Best effort: an object contract keeps only its declared top-level keys; anything else
        // (array/scalar contracts) passes through as-is.
        if (schema instanceof ZodObject && wire !== null && typeof wire === 'object' && !Array.isArray(wire)) {
          const known = new Set(Object.keys(schema.shape));
          return Object.fromEntries(
            Object.entries(wire as Record<string, unknown>).filter(([key]) => known.has(key)),
          );
        }
        return wire;
      }),
    );
  }
}
