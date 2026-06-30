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
  // Short-lived per-upload read URL for the homework photo (SAS in prod).
  imageUrl: z.string(),
  // The LLM DRAFT to validate against (never applied on its own).
  llmAnalysis: homeworkAnalysisSchema,
  createdAt: z.string(),
});

export const queuePageSchema = z.object({
  items: z.array(queueItemSchema),
  nextCursor: z.string().nullable(),
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
});

export const adminUserStatusSchema = z.object({
  accountId: z.string(),
  status: accountStatusEnum,
});
