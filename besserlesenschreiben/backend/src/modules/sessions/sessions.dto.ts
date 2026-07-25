import { z } from 'zod';
import { ZodDto } from '../../common/zod-dto';

/**
 * POST /sessions body. `profileId` selects which student (validated against the JWT account, never
 * trusted blindly). `unit` defaults to the profile's current unit. `source`: `bank` (default,
 * deterministic, free), `llm` (★ generated on the fly — free, but needs the LLM configured), or
 * `assigned` (a staff-authored lecture; requires `assignmentId`, ROADMAP §H1).
 */
export const createSessionSchema = z
  .object({
    profileId: z.string().uuid(),
    unit: z.number().int().min(1).max(50).optional(),
    source: z.enum(['bank', 'llm', 'assigned']).optional(),
    assignmentId: z.string().uuid().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.source === 'assigned' && !v.assignmentId) {
      ctx.addIssue({ code: 'custom', path: ['assignmentId'], message: 'assignmentId ist für zugewiesene Übungen erforderlich.' });
    }
  });
export class CreateSessionDto extends ZodDto(createSessionSchema) {}
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
