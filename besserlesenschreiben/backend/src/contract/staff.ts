import { z } from 'zod';

/**
 * Wire schemas for the STAFF realm (ARCHITECTURE §1a, SPEC §6). These publish the OpenAPI the reviewer
 * portal types from. The queue payload is PSEUDONYMISED: image + LLM draft + skill tags + a coarse band
 * only — never a child name, parent email, chat, or billing.
 */

export const staffMeSchema = z.object({
  reviewerId: z.string(),
  name: z.string(),
  role: z.enum(['reviewer', 'admin']),
});

// Structured homework vision output (SPEC §10). The LLM produces a DRAFT of this; the reviewer's verdict
// is an authoritative copy of the same shape.
export const homeworkAnalysisItemSchema = z.object({
  prompt: z.string(),
  childAnswer: z.string(),
  correct: z.boolean(),
  errorType: z.string().nullable().optional(),
});

export const homeworkAnalysisSchema = z.object({
  topic: z.string(),
  exerciseType: z.string(),
  items: z.array(homeworkAnalysisItemSchema),
  suggestedFocus: z.array(z.string()),
});

export const queueItemSchema = z.object({
  uploadId: z.string(),
  // Opaque, stable pseudonym for the child profile — never a real name.
  profileHandle: z.string(),
  // Coarse progress band (current unit), never an age/DOB.
  gradeBand: z.string(),
  skillTags: z.array(z.string()),
  // Short-lived per-upload read URL for the homework photo (presigned in prod).
  imageUrl: z.string(),
  // The LLM DRAFT to validate against (never applied on its own).
  llmAnalysis: homeworkAnalysisSchema,
  createdAt: z.string(),
  // Historical items (status=done): the reviewer's verdict + when. null while still open.
  decision: z.string().nullable(),
  reviewedAt: z.string().nullable(),
});

export const queuePageSchema = z.object({
  items: z.array(queueItemSchema),
  nextCursor: z.string().nullable(),
  total: z.number().int(), // count of open (unclaimed/lease-expired) pending-review items — drives the nav badge
});

export const claimResponseSchema = z.object({
  uploadId: z.string(),
  claimedUntil: z.string(),
});

export const reviewSubmitResponseSchema = z.object({
  status: z.enum(['reviewed', 'rejected']),
});

// ── User administration (STAFF realm, ADMIN role only; SPEC §6, ARCHITECTURE §1b) ───────────────
// Distinct from the pseudonymised review queue: these expose the real family email and account
// lifecycle. The owner's approval/control surface — admin-gated, identity-bearing.
export const accountStatusEnum = z.enum(['pending', 'active', 'deactivated']);

export const adminUserSchema = z.object({
  accountId: z.string(),
  email: z.string(),
  status: accountStatusEnum,
  createdAt: z.string(),
  profileCount: z.number().int(),
  lastActive: z.string().nullable(),
});

export const adminUserPageSchema = z.object({
  items: z.array(adminUserSchema),
  nextCursor: z.string().nullable(),
  total: z.number().int(), // count of accounts matching the status filter — drives the nav badge
});

// ── Learner progress (STAFF realm, ADMIN role only) ───────────────────────────────────────────────
// The same progress payload is served two ways: identity-bearing per account (Nutzer oversight) and
// PSEUDONYMISED per homework upload (review context) — the latter carries only the opaque handle.
export const skillMasterySchema = z.object({
  skill: z.string(),
  attempts: z.number().int(),
  correctPct: z.number().int(), // 0..100
  due: z.boolean(), // FSRS flags this skill as due
});

export const homeworkHistoryItemSchema = z.object({
  uploadId: z.string(),
  createdAt: z.string(),
  status: z.string(), // pending_analysis | pending_review | reviewed | …
  decision: z.string().nullable(), // approved | corrected | rejected | null (not yet reviewed)
  reviewedAt: z.string().nullable(),
});

export const leagueSchema = z.object({
  tier: z.enum(['bronze', 'silber', 'gold']),
  starsWeek: z.number().int(),
  starsToNext: z.number().int(),
});

export const profileProgressSchema = z.object({
  summary: z.object({
    unit: z.number().int(),
    streakDays: z.number().int(),
    stars: z.number().int(),
    lastActive: z.string().nullable(),
    league: leagueSchema,
  }),
  skills: z.array(skillMasterySchema), // weakest-first
  activity: z.object({
    totalAttempts: z.number().int(),
    sessions7d: z.number().int(),
    sessions30d: z.number().int(),
    homework: z.array(homeworkHistoryItemSchema), // most recent first
  }),
});

// Identity-bearing (Nutzer): every profile of an account, with its real name.
export const userProgressSchema = z.object({
  profiles: z.array(profileProgressSchema.extend({ profileId: z.string(), name: z.string() })),
});

// Pseudonymised (review queue): the upload's learner by opaque handle only — never a name.
export const queueProgressSchema = profileProgressSchema.extend({ profileHandle: z.string() });

export const adminUserStatusSchema = z.object({
  accountId: z.string(),
  status: accountStatusEnum,
});

// Lexeme foundation curation was dropped along with the Vokaltraining content set — the word-list
// schema is being redesigned. Re-add its contract schemas once the new shape is decided.
