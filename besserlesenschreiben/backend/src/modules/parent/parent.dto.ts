import { z } from 'zod';
import { ZodDto } from '../../common/zod-dto';

const pin = z.string().regex(/^\d{4}$/, 'PIN must be 4 digits');

export class SetPinDto extends ZodDto(z.object({ pin })) {}

// verify-pin binds the resulting parentToken to ONE child: the parent picks the target up front and it is
// signed into the token, so the destructive routes never read a child id from the body (security §1).
export const verifyPinSchema = z.object({ pin, profileId: z.string().uuid() });
export class VerifyPinDto extends ZodDto(verifyPinSchema) {}
