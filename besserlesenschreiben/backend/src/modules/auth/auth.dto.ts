import { z } from 'zod';
import { ZodDto } from '../../common/zod-dto';

export class RequestCodeDto extends ZodDto(
  z.object({
    email: z.email(),
  }),
) {}

export class VerifyDto extends ZodDto(
  z.object({
    email: z.email(),
    code: z.string().regex(/^\d{4}$/, 'Code must be 4 digits'),
  }),
) {}
