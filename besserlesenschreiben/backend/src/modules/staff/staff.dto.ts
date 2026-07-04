import { z } from 'zod';
import { ZodDto } from '../../common/zod-dto';
import { homeworkAnalysisSchema, lexemeCreateSchema, lexemeEditSchema } from '../../contract/staff';

export class StaffRequestCodeDto extends ZodDto(
  z.object({ email: z.email() }),
) {}

export class StaffVerifyDto extends ZodDto(
  z.object({
    email: z.email(),
    code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
  }),
) {}

export const reviewSubmitSchema = z
  .object({
    decision: z.enum(['approved', 'corrected', 'rejected']),
    // Required for approved|corrected (the authoritative verdict); omitted for rejected.
    reviewedAnalysis: homeworkAnalysisSchema.optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((d) => d.decision === 'rejected' || d.reviewedAnalysis !== undefined, {
    message: 'reviewedAnalysis is required unless the decision is rejected',
    path: ['reviewedAnalysis'],
  });

export class ReviewSubmitDto extends ZodDto(reviewSubmitSchema) {}
export type ReviewSubmitInput = z.infer<typeof reviewSubmitSchema>;

export class LexemeEditDto extends ZodDto(lexemeEditSchema) {}
export class LexemeCreateDto extends ZodDto(lexemeCreateSchema) {}
export type LexemeEditInput = z.infer<typeof lexemeEditSchema>;
export type LexemeCreateInput = z.infer<typeof lexemeCreateSchema>;
