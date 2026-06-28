import { z } from 'zod';
import { ZodDto } from '../../common/zod-dto';

const pin = z.string().regex(/^\d{4}$/, 'PIN must be 4 digits');

export class SetPinDto extends ZodDto(z.object({ pin })) {}
export class VerifyPinDto extends ZodDto(z.object({ pin })) {}

// Parent-scoped actions target a specific child. The account is from the JWT; profileId is validated
// against it in the service (assertProfileOwned).
export const profileTargetSchema = z.object({ profileId: z.string().uuid() });
export class ProfileTargetDto extends ZodDto(profileTargetSchema) {}
