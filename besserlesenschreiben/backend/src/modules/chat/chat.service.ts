import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { assertProfileOwned } from '../../common/ownership';
import { ApiException } from '../../common/exceptions/api-exception';
import { startOfUtcDay } from '../../common/dates';
import { LlmService } from '../../services/llm/llm.service';
import type { LlmMessage } from '../../services/llm/llm.types';

interface WireMessage {
  me: boolean;
  text: string;
  ts: string;
}

const HISTORY_LIMIT = 100; // most-recent messages returned to the client
const CONTEXT_TURNS = 20; // how many prior messages to give the model
const REPLY_MAX_TOKENS = 400;

/**
 * Trainer chat ("Angelika") — a free ★ AI feature (ARCHITECTURE §9 deferred → no credit gate). The child
 * talks to a warm, child-safe German literacy tutor. `profileId` ownership is verified from the JWT account
 * (security §1). We never log message text (child content, §6).
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger('ChatService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** The persona + guardrails for the tutor. Kept here (not the client) so it can't be tampered with. */
  private static readonly SYSTEM = [
    'Du bist Angelika, eine warmherzige Lese- und Schreibtrainerin für Kinder im Grundschulalter.',
    'Antworte immer auf Deutsch, kurz (1–3 Sätze), einfach, geduldig und ermutigend.',
    'Bleib beim Thema Lesen, Schreiben, Buchstaben, Silben, Reime und Lernen.',
    'Lenke freundlich zurück, wenn das Kind abschweift. Stelle höchstens eine kleine Frage.',
    'Frage NIE nach persönlichen Daten (Name, Adresse, Alter, Schule, Telefon). Verlange keine Fotos.',
    'Keine unangemessenen, beängstigenden oder gewalttätigen Inhalte. Sei sicher und kindgerecht.',
  ].join(' ');

  /** Conversation history, oldest→newest, capped. `me=true` is the child, `me=false` the trainer. */
  async history(accountId: string, profileId: string): Promise<{ messages: WireMessage[] }> {
    await assertProfileOwned(this.prisma, accountId, profileId);
    const rows = await this.prisma.chatMessage.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    });
    rows.reverse(); // back to chronological after taking the newest N
    return { messages: rows.map((r) => ({ me: r.role === 'child', text: r.text, ts: r.createdAt.toISOString() })) };
  }

  /** Persist the child's message, get the trainer's reply from the LLM, persist + return it. */
  async send(accountId: string, profileId: string, text: string): Promise<{ reply: WireMessage }> {
    await assertProfileOwned(this.prisma, accountId, profileId);

    // Daily cap on the cost-bearing path (counts the child's sent messages today, from existing rows).
    // Checked BEFORE persisting so an over-cap message costs nothing and doesn't skew the history.
    const cap = this.config.get('CHAT_MESSAGES_PER_DAY', { infer: true });
    const sentToday = await this.prisma.chatMessage.count({
      where: { profileId, role: 'child', createdAt: { gte: startOfUtcDay(new Date()) } },
    });
    if (sentToday >= cap) {
      this.logger.log({ event: 'chat.capped', cap }, 'daily chat cap hit');
      throw new ApiException(
        429,
        'RATE_LIMITED',
        'Angelika braucht jetzt eine kleine Pause. Morgen könnt ihr weiterschreiben!',
      );
    }

    await this.prisma.chatMessage.create({ data: { profileId, role: 'child', text } });

    // Recent turns for context (chronological), mapped to the LLM message shape.
    const recent = await this.prisma.chatMessage.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      take: CONTEXT_TURNS,
    });
    recent.reverse();
    const messages: LlmMessage[] = recent.map((r) => ({
      role: r.role === 'child' ? 'user' : 'assistant',
      text: r.text,
    }));

    const replyText = await this.llm.chat({ system: ChatService.SYSTEM, messages, maxTokens: REPLY_MAX_TOKENS });

    const saved = await this.prisma.chatMessage.create({
      data: { profileId, role: 'trainer', text: replyText },
    });
    this.logger.log({ event: 'chat.reply', provider: this.llm.providerName }, 'chat reply generated');
    return { reply: { me: false, text: saved.text, ts: saved.createdAt.toISOString() } };
  }
}
