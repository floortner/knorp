import { z } from 'zod';
import { ZodDto } from '../../common/zod-dto';

const pin = z.string().regex(/^\d{4}$/, 'PIN must be 4 digits');

// `currentPin` is required to CHANGE an existing PIN — without it, anyone holding the family session (in
// practice the child, on the family device) could overwrite the PIN and defeat the parent gate on the
// destructive routes (security review P1-1). The first-ever set (no PIN yet) omits it.
export const setPinSchema = z.object({ pin, currentPin: pin.optional() });
export class SetPinDto extends ZodDto(setPinSchema) {}

// verify-pin binds the resulting parentToken to ONE child: the parent picks the target up front and it is
// signed into the token, so the destructive routes never read a child id from the body (security §1).
export const verifyPinSchema = z.object({ pin, profileId: z.string().uuid() });
export class VerifyPinDto extends ZodDto(verifyPinSchema) {}
