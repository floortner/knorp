import { z } from 'zod';
import { exerciseSchema } from './exercise';
import { homeworkAnalysisSchema } from './staff';

/**
 * Wire schemas for the API read/response models (mirrors the service return shapes; SPEC §6). These
 * publish the OpenAPI the frontend types from. Dates are serialised to ISO strings on the wire.
 */

export const okSchema = z.object({ ok: z.literal(true) });

// ── Auth ─────────────────────────────────────────────────────────────────────
// The session JWT is delivered ONLY as an httpOnly cookie (set by the controller) — never in the body, so
// no long-lived credential is ever exposed to page JavaScript (security review P1-4).
export const verifyResponseSchema = z.object({ isNewAccount: z.boolean() });

// ── Profiles ───────────────────────────────────────────────────────────────────
export const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  buddy: z.string(),
  goalPerWeek: z.number().int(),
  soundOn: z.boolean(),
  dyslexicFont: z.boolean(),
  fontScale: z.number(),
  stars: z.number().int(),
  streakDays: z.number().int(),
  jokerAvailable: z.boolean(),
  unlockedUnit: z.number().int(),
  createdAt: z.string(),
});

export const meSchema = z.object({
  account: z.object({ id: z.string(), email: z.string() }),
  profiles: z.array(profileSchema),
});

export const profileDetailSchema = z.object({
  profile: profileSchema,
  settings: z.object({
    soundOn: z.boolean(),
    dyslexicFont: z.boolean(),
    fontScale: z.number(),
    goalPerWeek: z.number().int(),
    buddy: z.string(),
  }),
  stars: z.number().int(),
  streak: z.number().int(),
});

export const profileEnvelopeSchema = z.object({ profile: profileSchema });

// ── Units / sessions / attempts ────────────────────────────────────────────────
export const unitStatusSchema = z.enum(['locked', 'current', 'done']);

export const unitSchema = z.object({
  unit: z.number().int(),
  title: z.string(),
  subtitle: z.string(),
  focus: z.string(),
  exerciseTypes: z.array(z.string()),
  itemCount: z.number().int(),
  status: unitStatusSchema,
  theme: z.object({ iconBg: z.string(), iconColor: z.string() }),
});
export const unitsSchema = z.array(unitSchema);

export const sessionResponseSchema = z.object({
  sessionId: z.string(),
  profileId: z.string(),
  unit: z.number().int(),
  generatedAt: z.string(),
  // Short teaching text ("Merke: …") shown as a card before the first exercise. Only LLM-generated
  // lectures carry one; bank sessions omit it. Must live in this schema or the ZodResponseInterceptor
  // strips it from the wire.
  intro: z.string().optional(),
  items: z.array(exerciseSchema),
});

export const leagueSchema = z.object({
  tier: z.enum(['bronze', 'silber', 'gold']),
  starsWeek: z.number().int(),
  starsToNext: z.number().int(),
});

export const sessionCompleteSchema = z.object({
  starsAwarded: z.number().int(),
  streakDays: z.number().int(),
  jokerAvailable: z.boolean(),
  jokerConsumed: z.boolean(),
  league: leagueSchema,
  // True once the student has completed the final unit — the backend is authoritative so the client never
  // has to hardcode the unit count to decide whether to show the all-units celebration.
  allUnitsComplete: z.boolean(),
});

// ── Progress / digest ──────────────────────────────────────────────────────────
export const progressSchema = z.object({
  streakDays: z.number().int(),
  jokerAvailable: z.boolean(),
  stars: z.number().int(),
  weeklyActivity: z.array(z.number().int()),
  monthlyHeatmap: z.array(z.object({ date: z.string(), count: z.number().int() })),
  league: leagueSchema,
  skillBreakdown: z.array(
    z.object({
      skill: z.string(),
      attempts: z.number().int(),
      correctPct: z.number().int(),
      due: z.boolean(),
    }),
  ),
});

export const digestSchema = z.object({ markdown: z.string() });

// ── Homework status (shared with chat below) ───────────────────────────────────
export const homeworkStatusEnum = z.enum(['pending_analysis', 'pending_review', 'reviewed', 'rejected']);

// ── Chat (trainer) ─────────────────────────────────────────────────────────────
export const chatMessageSchema = z.object({
  me: z.boolean(), // true = the student, false = the trainer (Angelika)
  text: z.string(),
  ts: z.string(), // ISO timestamp
  imageUrl: z.string().optional(), // homework photo bubble (a short-lived read URL); absent on text messages
  // Present ONLY on a homework STATUS bubble — lets the client render a status-specific affordance
  // (e.g. a "Zu deinen neuen Übungen" button once `reviewed`).
  homeworkStatus: homeworkStatusEnum.optional(),
});
export const chatHistorySchema = z.object({ messages: z.array(chatMessageSchema) });
export const chatReplySchema = z.object({ reply: chatMessageSchema });

// ── Homework (family realm) ─────────────────────────────────────────────────────
export const homeworkUploadResponseSchema = z.object({
  uploadId: z.string(),
  status: homeworkStatusEnum,
});
// The family sees only the AUTHORITATIVE result, and only once reviewed — never the raw LLM draft (§10).
export const homeworkResultSchema = z.object({
  status: homeworkStatusEnum,
  reviewedAnalysis: homeworkAnalysisSchema.nullable(),
});
