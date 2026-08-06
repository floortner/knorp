import { z } from 'zod';
import { exerciseSchema } from './exercise';

/**
 * Wire schemas for the STAFF realm (ARCHITECTURE §1a, SPEC §6). These publish the OpenAPI the trainer
 * portal types from. Known-trainer model (ROADMAP §H1.3): staff surfaces carry the student's real NAME
 * and learning data — the 2–3 trainers know each student personally. Data minimisation still applies:
 * never a parent email, chat text, or billing on any trainer surface; account identity/lifecycle stays
 * on the admin-only /staff/users routes.
 */

export const staffMeSchema = z.object({
  trainerId: z.string(),
  name: z.string(),
  role: z.enum(['trainer', 'admin']),
  // The trainer's OWN staff identity (profile page) — staff-realm data, never a family email.
  email: z.string(),
  createdAt: z.string(),
});

// Structured homework vision output (SPEC §10). The LLM produces a DRAFT of this; the trainer's verdict
// is an authoritative copy of the same shape.
// Length/count bounds (security review P2-4): the draft is derived from an uploaded photo (adversarial
// OCR surface) and its focus tags are written straight into the scheduler on approval — bound every field
// so an injected wall of text can't become a skill tag or an unbounded write. Constraints only (no
// transforms) so the same schema still drives the LLM structured-output JSON schema. Trimming/dedupe and
// taxonomy-filtering happen at apply time in review.service.
const skillTag = z.string().min(1).max(64);

export const homeworkAnalysisItemSchema = z.object({
  prompt: z.string().max(2000),
  // Legacy wire key, kept for compatibility with stored drafts (llm_analysis JSON) — means "the student's answer".
  childAnswer: z.string().max(2000),
  correct: z.boolean(),
  errorType: skillTag.nullable().optional(),
});

export const homeworkAnalysisSchema = z.object({
  topic: z.string().max(200),
  exerciseType: z.string().max(200),
  items: z.array(homeworkAnalysisItemSchema).max(50),
  suggestedFocus: z.array(skillTag).max(20),
});

export const queueItemSchema = z.object({
  uploadId: z.string(),
  // The student, by real name (known-trainer model, rule-10 revision §H1.3) + id for /students links.
  profileId: z.string(),
  name: z.string(),
  // Coarse progress band (current unit), never an age/DOB.
  gradeBand: z.string(),
  skillTags: z.array(z.string()),
  // Short-lived per-upload read URL for the homework photo (presigned in prod).
  imageUrl: z.string(),
  // The LLM DRAFT to validate against (never applied on its own).
  llmAnalysis: homeworkAnalysisSchema,
  createdAt: z.string(),
  // ANOTHER trainer holds a live claim lease (in Prüfung) — shown locked/non-actionable in the queue.
  // false for the caller's own claim, so a trainer can always re-open their own item.
  claimed: z.boolean(),
  // Historical items (status=done): the trainer's verdict + when. null while still open.
  decision: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  // Historical items: the authoritative verdict + the trainer's student-visible comment (read-only
  // detail view). Both null while open or when the item was rejected (reject applies nothing).
  reviewedAnalysis: homeworkAnalysisSchema.nullable(),
  notes: z.string().nullable(),
});

export const queuePageSchema = z.object({
  items: z.array(queueItemSchema),
  nextCursor: z.string().nullable(),
  // Count of ALL items matching the filter (for 'open': every pending_review row, incl. live-claimed
  // ones — the queue deliberately shows work in progress). Drives the nav badge.
  total: z.number().int(),
});

export const claimResponseSchema = z.object({
  uploadId: z.string(),
  claimedUntil: z.string(),
});

export const reviewSubmitResponseSchema = z.object({
  status: z.enum(['reviewed', 'rejected']),
});

// ── User administration (STAFF realm, ADMIN role only; SPEC §6, ARCHITECTURE §1b) ───────────────
// Distinct from the all-trainer surfaces: these additionally expose the real family email and account
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

// ── Learner progress (STAFF realm) ────────────────────────────────────────────────────────────────
// The same progress payload is served three ways: per account (Nutzer oversight, ADMIN only), per
// student (learner directory detail, all trainers), and per homework upload (review context, all
// trainers) — the latter two are identical shapes (studentDetailSchema).
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

export const adminUserStatusSchema = z.object({
  accountId: z.string(),
  status: accountStatusEnum,
});

// ── Learner directory + activity (STAFF realm, ALL trainers; ROADMAP §H1.3 + §H3.1) ──────────────
// The trainer's read model over the existing session/attempt telemetry — no new tables. Names are
// shown (known-trainer model); parent email/chat/billing never appear here.

export const sessionSourceEnum = z.enum(['bank', 'llm', 'homework', 'assigned']);

export const studentListItemSchema = z.object({
  profileId: z.string(),
  name: z.string(),
  unit: z.number().int(), // Einheit — coarse band (profile.unlockedUnit)
  streakDays: z.number().int(),
  lastActive: z.string().nullable(),
  sessions7d: z.number().int(), // completed sessions, rolling windows
  sessions30d: z.number().int(),
  totalAttempts: z.number().int(),
  weakestSkills: z.array(skillMasterySchema), // ≤3, weakest-first, 30d window (full list on detail)
});

export const studentPageSchema = z.object({
  items: z.array(studentListItemSchema),
  nextCursor: z.string().nullable(),
  total: z.number().int(),
});

// Learner detail header — the exact progress payload ProgressPanel renders, plus identity.
export const studentDetailSchema = profileProgressSchema.extend({
  profileId: z.string(),
  name: z.string(),
});

// Review context for an upload (all trainers) — same shape as the learner detail.
export const queueProgressSchema = studentDetailSchema;

export const studentSessionSchema = z.object({
  sessionId: z.string(),
  source: sessionSourceEnum,
  startedAt: z.string(), // session.createdAt — there is no separate started_at column
  completedAt: z.string().nullable(),
  // completedAt null = never finished — EXCEPT homework sessions, which are terminal by design
  // (created already-decided with itemIds [] and no completedAt; review.service).
  abandoned: z.boolean(),
  itemsTotal: z.number().int(), // itemIds.length (0 for homework)
  itemsAnswered: z.number().int(), // distinct itemIds attempted; homework: attempt-row count
  attemptCount: z.number().int(), // all attempt rows incl. retries
  // Attempt-level (correct attempts / all attempts), rounded — same semantics as skillMastery's
  // correctPct so the number means one thing everywhere. null when no attempts yet.
  correctPct: z.number().int().nullable(),
  activeMs: z.number().int(), // Σ attempt.timeMs — engagement time; survives abandonment/tab-parking
});

export const studentSessionPageSchema = z.object({
  items: z.array(studentSessionSchema),
  nextCursor: z.string().nullable(),
  total: z.number().int(),
});

export const studentAttemptSchema = z.object({
  attemptId: z.string(),
  itemId: z.string().nullable(),
  exerciseType: z.string(),
  prompt: z.string(),
  expected: z.string(),
  given: z.string(),
  isCorrect: z.boolean(),
  timeMs: z.number().int(),
  attemptNo: z.number().int(),
  skillTags: z.array(z.string()),
  createdAt: z.string(),
});

// Question-by-question drill-down: the session summary + the student name (so the screen is
// self-contained, no separate progress rollup) + attempts in answer order (createdAt asc, id asc).
export const studentSessionDetailSchema = studentSessionSchema.extend({
  name: z.string(),
  attempts: z.array(studentAttemptSchema),
});

// ── Content-library lectures + assignments (STAFF realm, ALL trainers; ROADMAP §I/§H1) ──────────
// A lecture = Merksatz intro + ordered exercises, authored as markdown in content/ and imported by
// the deploy (§I2) — the portal browses, assigns (an OFFER on /lernen, never a push), and tracks
// outcomes; it does not author. The wire never sees 'superseded' rows (list/detail filter them);
// version is the content-library version pinned by assignments via the lecture id.
export const lectureStatusEnum = z.enum(['draft', 'published']);
export const assignmentStatusEnum = z.enum(['open', 'started', 'completed']);

export const lectureListItemSchema = z.object({
  lectureId: z.string(),
  slug: z.string(), // content-library natural key (filename in content/lectures/)
  version: z.number().int(),
  title: z.string(),
  status: lectureStatusEnum, // draft = in the files but not yet freigegeben — never assignable
  skillTags: z.array(z.string()), // union of the items' tags, computed on import
  itemCount: z.number().int(),
  assignmentCounts: z.object({
    // Counted across ALL versions of the slug — a version bump must not reset the history.
    open: z.number().int(),
    started: z.number().int(),
    completed: z.number().int(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const lecturePageSchema = z.object({
  items: z.array(lectureListItemSchema),
  nextCursor: z.string().nullable(),
  total: z.number().int(),
});

// Detail carries the full wire-shape items (same Exercise union the family app renders).
export const lectureDetailSchema = lectureListItemSchema.extend({
  intro: z.string(),
  items: z.array(exerciseSchema),
});

export const assignResultSchema = z.object({
  assigned: z.number().int(),
  skipped: z.number().int(), // already assigned (idempotent re-assign)
});

export const lectureAssignmentSchema = z.object({
  assignmentId: z.string(),
  profileId: z.string(),
  name: z.string(),
  status: assignmentStatusEnum, // derived: open (no session) | started | completed
  assignedAt: z.string(),
  sessionId: z.string().nullable(), // links to the /students session drill-down for per-item results
  completedAt: z.string().nullable(),
  correctPct: z.number().int().nullable(),
  itemsAnswered: z.number().int(),
  itemsTotal: z.number().int(),
  activeMs: z.number().int(),
});

export const lectureAssignmentListSchema = z.object({
  items: z.array(lectureAssignmentSchema),
});

// Per-STUDENT view of the same assignment rollup, keyed by lecture — the learner detail's
// "Zuweisungen" section. An OPEN assignment is visible here before any session exists (the session
// timeline can only show played ones).
export const studentAssignmentSchema = z.object({
  assignmentId: z.string(),
  lectureId: z.string(), // the pinned version row — links to /lectures/:lectureId
  title: z.string(),
  version: z.number().int(),
  status: assignmentStatusEnum,
  assignedAt: z.string(),
  sessionId: z.string().nullable(), // links to the session drill-down once started
  completedAt: z.string().nullable(),
  correctPct: z.number().int().nullable(),
});

export const studentAssignmentListSchema = z.object({
  items: z.array(studentAssignmentSchema),
});

// Lexeme foundation curation was dropped along with the Vokaltraining content set — the word-list
// schema is being redesigned. Re-add its contract schemas once the new shape is decided.
