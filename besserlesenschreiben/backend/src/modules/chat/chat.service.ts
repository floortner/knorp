import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { assertProfileOwned } from '../../common/ownership';
import { ApiException } from '../../common/exceptions/api-exception';
import { startOfUtcDay } from '../../common/dates';
import { LlmService } from '../../services/llm/llm.service';
import type { LlmMessage } from '../../services/llm/llm.types';
import { StorageService } from '../../services/storage/storage.service';
import { homeworkAnalysisSchema } from '../../contract/staff';

interface WireMessage {
  me: boolean;
  text: string;
  ts: string;
  imageUrl?: string;
}

const HISTORY_LIMIT = 100; // most-recent messages returned to the client
const CONTEXT_TURNS = 20; // how many prior messages to give the model
const REPLY_MAX_TOKENS = 400;
const HOMEWORK_HISTORY = 20; // recent homework uploads surfaced as chat bubbles
const HW_URL_TTL_S = 3600; // family read-URL lifetime for their own homework photo

/**
 * The trainer's line under a homework photo, reflecting its CURRENT review status. On `reviewed` it draws
 * from the AUTHORITATIVE `reviewedAnalysis` (topic + what to practise next) — never the LLM draft.
 */
function homeworkStatusText(status: string, reviewedAnalysis: unknown): string {
  if (status === 'rejected') return 'Das Foto konnte leider nicht verwendet werden. Versuch es mit einem klareren Bild. 🙈';
  if (status === 'reviewed') {
    const parsed = homeworkAnalysisSchema.safeParse(reviewedAnalysis);
    if (parsed.success) {
      const focus = parsed.data.suggestedFocus.length
        ? ` Als Nächstes üben wir: ${parsed.data.suggestedFocus.join(', ')}.`
        : '';
      return `Deine Hausübung ist geprüft ✅ — ${parsed.data.topic}.${focus}`;
    }
    return 'Deine Hausübung ist geprüft ✅ — die nächsten Übungen sind jetzt für dich angepasst.';
  }
  return 'Dein Foto ist da! 📚 Eine Fachkraft schaut es sich an und passt deine nächsten Übungen an.';
}

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
    private readonly storage: StorageService,
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

  /**
   * Conversation history, oldest→newest, capped. `me=true` is the child, `me=false` the trainer. The
   * child's homework uploads are surfaced here as durable chat bubbles — a photo (a short-lived read URL
   * to the family's OWN image) plus a trainer line reflecting the upload's current review status — so they
   * persist across reloads. These are synthesized for DISPLAY only; the LLM `send` context reads the stored
   * chatMessage rows, so homework never enters the model prompt.
   */
  async history(accountId: string, profileId: string): Promise<{ messages: WireMessage[] }> {
    await assertProfileOwned(this.prisma, accountId, profileId);
    const [chatRows, hwRows] = await Promise.all([
      this.prisma.chatMessage.findMany({ where: { profileId }, orderBy: { createdAt: 'desc' }, take: HISTORY_LIMIT }),
      this.prisma.homeworkUpload.findMany({
        where: { profileId },
        orderBy: { createdAt: 'desc' },
        take: HOMEWORK_HISTORY,
        select: { imageKey: true, status: true, createdAt: true, reviewedAnalysis: true },
      }),
    ]);

    // An entry is a wire message + an optional imageKey to sign LATER — only if it survives the window.
    type Entry = { msg: WireMessage; imageKey?: string };
    const entries: Entry[] = chatRows.map((r) => ({
      msg: { me: r.role === 'child', text: r.text, ts: r.createdAt.toISOString() },
    }));
    for (const h of hwRows) {
      // Photo + status share the upload's timestamp so the pair stays adjacent (stable sort keeps insert order).
      const ts = h.createdAt.toISOString();
      entries.push({ msg: { me: true, text: '', ts }, imageKey: h.imageKey });
      entries.push({ msg: { me: false, text: homeworkStatusText(h.status, h.reviewedAnalysis), ts } });
    }

    // Newest HISTORY_LIMIT overall (chat + homework interleaved), then sign only the surviving photo bubbles
    // with a STABLE URL so the browser can cache the image across the frequent history refetches.
    const window = entries.sort((a, b) => a.msg.ts.localeCompare(b.msg.ts)).slice(-HISTORY_LIMIT);
    const messages = await Promise.all(
      window.map(async (e): Promise<WireMessage> =>
        e.imageKey
          ? { ...e.msg, imageUrl: await this.storage.signedHomeworkReadUrl(e.imageKey, HW_URL_TTL_S, { stable: true }) }
          : e.msg,
      ),
    );
    return { messages };
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
