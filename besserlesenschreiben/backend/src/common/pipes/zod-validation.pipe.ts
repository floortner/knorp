import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ApiException } from '../exceptions/api-exception';

/**
 * Validates DTO params against their Zod schema and emits the 422 VALIDATION_ERROR envelope.
 *
 * We DON'T use nestjs-zod's ZodValidationPipe: its bundled `@nest-zod/z` calls `zod.defaultErrorMap`,
 * an API removed in Zod 4, which crashes the moment validation fails (a 500 instead of a 422). This
 * pipe calls plain Zod 4 `safeParse` directly. DTOs are still `createZodDto(...)`, which stores the
 * schema as a static `schema` we read here.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const schema = (metadata.metatype as { schema?: ZodType } | undefined)?.schema;
    if (!schema || typeof schema.safeParse !== 'function') return value;

    const result = schema.safeParse(value);
    if (!result.success) {
      throw new ApiException(
        422,
        'VALIDATION_ERROR',
        'Eingabe ungültig.',
        result.error.issues.map((i) => ({
          field: i.path.join('.') || '(root)',
          issue: i.message,
        })),
      );
    }
    return result.data;
  }
}
