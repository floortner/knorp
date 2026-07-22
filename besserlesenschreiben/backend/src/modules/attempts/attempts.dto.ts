import { z } from 'zod';
import { ZodDto } from '../../common/zod-dto';

/**
 * POST /attempts body — one row per answered item (the telemetry spine, SPEC §6). `profileId` is NOT
 * accepted from the client: it is derived from the session. `prompt`/`expected`/`given` are stored
 * but MUST never be logged (student-answer content, security rule §6).
 */
export const createAttemptSchema = z.object({
  sessionId: z.string().uuid(),
  itemId: z.string().uuid().nullish(), // null/absent for homework / ad-hoc items
  exerciseType: z.string().min(1).max(20),
  prompt: z.string().max(200),
  expected: z.string().max(200),
  given: z.string().max(200),
  isCorrect: z.boolean(),
  timeMs: z.number().int().min(0).max(600_000),
  attemptNo: z.number().int().min(1).max(20).optional(),
  skillTags: z.array(z.string().min(1).max(40)).max(10),
});
export class CreateAttemptDto extends ZodDto(createAttemptSchema) {}
export type CreateAttemptInput = z.infer<typeof createAttemptSchema>;
