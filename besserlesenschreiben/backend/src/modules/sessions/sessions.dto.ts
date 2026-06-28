import { z } from 'zod';
import { ZodDto } from '../../common/zod-dto';

/**
 * POST /sessions body. `profileId` selects which child (validated against the JWT account, never
 * trusted blindly). `unit` defaults to the profile's current unit. `source` is bank-only for now —
 * LLM sessions (★) arrive in a later milestone, so anything else fails validation with 422.
 */
export const createSessionSchema = z.object({
  profileId: z.string().uuid(),
  unit: z.number().int().min(1).max(50).optional(),
  source: z.literal('bank').optional(),
});
export class CreateSessionDto extends ZodDto(createSessionSchema) {}
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
