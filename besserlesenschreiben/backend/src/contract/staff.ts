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

// ── Lexeme foundation curation (STAFF realm, ADMIN role; SPEC §6) ────────────────────────────────
// Edit the annotated word pool that grounds lecture generation. Corrections are layered over the
// PDF-extracted base and exported to the committed lexeme.overrides.json (so they survive reseeds and
// reproduce in any fresh DB). Raw orthographic flags (v-Schreibung, Silbengelenk, …) → string|boolean.
export const lexemeFeaturesSchema = z.record(z.string(), z.union([z.string(), z.boolean()]));

export const lexemeSchema = z.object({
  lemma: z.string(),
  hk: z.number().int(),
  pos: z.string(),
  genus: z.string().nullable(),
  morphemeCount: z.number().int(),
  ipa: z.string(),
  syllabification: z.string(),
  syllableCount: z.number().int(),
  forms: z.string().nullable(),
  separablePrefix: z.string().nullable(),
  familyStem: z.string().nullable(), // shared root grouping a Wortfamilie → `family` exercises
  compoundParts: z.array(z.string()), // ordered compound parts (["Holz","Treppe"]); [] = not a compound
  features: lexemeFeaturesSchema,
  skillTags: z.array(z.string()),
  isLernwort: z.boolean(),
  isTrennbar: z.boolean(),
  isMerkwort: z.boolean(),
  source: z.string(),
});

export const lexemePageSchema = z.object({
  items: z.array(lexemeSchema),
  nextCursor: z.string().nullable(),
  total: z.number().int(),
});

// Edit = sparse patch (only changed fields). lemma is the path key; source is server-owned.
export const lexemeEditSchema = lexemeSchema.omit({ lemma: true, source: true }).partial();

// Add = a full new word (source defaulted to 'reviewer' by the server).
export const lexemeCreateSchema = lexemeSchema.omit({ source: true });

export const lexemeExportResultSchema = z.object({
  edits: z.number().int(),
  adds: z.number().int(),
  deletes: z.number().int(),
});

// Aggregate stats over the current filter (how many words match, broken down by property).
const lexemeCountSchema = z.object({ value: z.string(), count: z.number().int() });
export const lexemeStatsSchema = z.object({
  total: z.number().int(),
  byPos: z.array(lexemeCountSchema),
  byGenus: z.array(lexemeCountSchema),
  bySource: z.array(lexemeCountSchema),
  bySkill: z.array(lexemeCountSchema),
  bySyllableCount: z.array(lexemeCountSchema),
  byMorpheme: z.array(lexemeCountSchema),
  flags: z.object({ lernwort: z.number().int(), trennbar: z.number().int(), merkwort: z.number().int() }),
  hk: z.object({ min: z.number().int(), max: z.number().int(), avg: z.number() }),
});
