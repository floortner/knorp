import { z } from 'zod';
import { ZodDto } from '../../common/zod-dto';

const buddy = z.enum(['nepo', 'stella']);

// Defaults are applied in the service (not via Zod `.default()`) to keep the DTOs simple.
export const createProfileSchema = z.object({
  name: z.string().trim().min(1).max(40),
  buddy: buddy.optional(),
  goal: z.number().int().min(1).max(14).optional(),
});
export class CreateProfileDto extends ZodDto(createProfileSchema) {}
export type CreateProfileInput = z.infer<typeof createProfileSchema>;

export const updateSettingsSchema = z.object({
  soundOn: z.boolean().optional(),
  dyslexicFont: z.boolean().optional(),
  fontScale: z.number().min(0.8).max(2).optional(),
  goal: z.number().int().min(1).max(14).optional(),
  buddy: buddy.optional(),
});
export class UpdateSettingsDto extends ZodDto(updateSettingsSchema) {}
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
