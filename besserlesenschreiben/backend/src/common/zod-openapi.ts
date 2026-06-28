import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { z, type ZodType } from 'zod';

type ApiBodyOpts = Parameters<typeof ApiBody>[0];
type ApiResponseOpts = Parameters<typeof ApiOkResponse>[0];

/** Handler-metadata key carrying the response Zod schema for ZodResponseInterceptor. */
export const ZOD_RESPONSE_KEY = 'zod:response';

/**
 * Bridge Zod → OpenAPI so the generated frontend types (`npm run gen:api`) reflect the real contract
 * instead of bare schemas. Zod 4 emits OpenAPI-3.0-compatible JSON Schema natively; `io` distinguishes
 * request (input) from response (output) shapes.
 */
export function zodToOpenApi(schema: ZodType, io: 'input' | 'output' = 'output'): Record<string, unknown> {
  return z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io,
    unrepresentable: 'any',
  }) as Record<string, unknown>;
}

/** Document a JSON request body from its Zod schema. */
export function ApiZodBody(schema: ZodType) {
  return applyDecorators(ApiBody({ schema: zodToOpenApi(schema, 'input') } as ApiBodyOpts));
}

/**
 * Document a 2xx response from its Zod schema AND register it for runtime validation
 * (ZodResponseInterceptor) — so the published contract can't silently drift from what services return.
 */
export function ApiZodResponse(schema: ZodType) {
  return applyDecorators(
    ApiOkResponse({ schema: zodToOpenApi(schema, 'output') } as ApiResponseOpts),
    SetMetadata(ZOD_RESPONSE_KEY, schema),
  );
}
