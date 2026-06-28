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
import type { ZodType } from 'zod';
import { ZOD_RESPONSE_KEY } from '../zod-openapi';
import type { Env } from '../../config/env';

/**
 * Validates every 2xx body against the SAME Zod schema published to OpenAPI (via @ApiZodResponse), so
 * the contract the frontend types from can't silently drift from what services actually return.
 *
 * Validation runs on the JSON-roundtripped body (Dates → ISO strings) to match the real wire shape,
 * and returns the parsed value (unknown keys stripped → wire == contract). On a mismatch: throw in
 * non-prod (fail loud in dev/CI), log + pass the body through in prod (never break a live response).
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
        return body; // prod: log but don't break the live response
      }),
    );
  }
}
