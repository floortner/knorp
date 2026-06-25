import { z, type ZodType } from 'zod';

export interface ZodDtoClass<T extends ZodType> {
  new (): z.infer<T>;
  schema: T;
}

/**
 * Minimal Zod DTO factory: a class carrying its schema as a static `schema` (read by
 * ZodValidationPipe), whose instance type is the schema's inferred output.
 *
 * Replaces nestjs-zod, whose bundled `@nest-zod/z` calls `zod.setErrorMap()` on import with a
 * Zod-3-shaped map that invokes the removed `zod.defaultErrorMap` — crashing on EVERY Zod 4
 * validation failure (500 instead of 422). Keeping zod un-imported by nestjs-zod avoids that.
 */
export function ZodDto<T extends ZodType>(schema: T): ZodDtoClass<T> {
  class Dto {
    static schema = schema;
  }
  return Dto as unknown as ZodDtoClass<T>;
}
