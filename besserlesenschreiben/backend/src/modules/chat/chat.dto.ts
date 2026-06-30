import { z } from 'zod';
import { ZodDto } from '../../common/zod-dto';

/**
 * POST /chat/:profileId body. `profileId` is a path selector verified against the JWT account
 * (never trusted from the body). `text` is the child's message — stored, but MUST never be logged
 * (child content, security rule §6).
 */
export const sendChatSchema = z.object({ text: z.string().min(1).max(1000) });
export class SendChatDto extends ZodDto(sendChatSchema) {}
export type SendChatInput = z.infer<typeof sendChatSchema>;
