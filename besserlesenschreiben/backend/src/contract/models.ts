import { z } from 'zod';
import { exerciseSchema } from './exercise';

/**
 * Wire schemas for the API read/response models (mirrors the service return shapes; SPEC §6). These
 * publish the OpenAPI the frontend types from. Dates are serialised to ISO strings on the wire.
 */

export const okSchema = z.object({ ok: z.literal(true) });

// ── Auth ─────────────────────────────────────────────────────────────────────
export const verifyResponseSchema = z.object({ token: z.string(), isNewAccount: z.boolean() });

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
  league: leagueSchema,
});

// ── Progress / digest ──────────────────────────────────────────────────────────
export const progressSchema = z.object({
  streakDays: z.number().int(),
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

// ── Parent ─────────────────────────────────────────────────────────────────────
export const parentTokenSchema = z.object({ parentToken: z.string() });
export const unlockNextSchema = z.object({ ok: z.literal(true), unlockedUnit: z.number().int() });
