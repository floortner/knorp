import { z } from 'zod';
import { ZodDto } from '../../common/zod-dto';

const pin = z.string().regex(/^\d{4}$/, 'PIN must be 4 digits');

export class SetPinDto extends ZodDto(z.object({ pin })) {}
export class VerifyPinDto extends ZodDto(z.object({ pin })) {}
