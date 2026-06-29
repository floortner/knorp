/**
 * PROVISIONAL staff contract types.
 *
 * These are hand-authored to mirror `../backend/SPEC.md §6` (staff routes) + §10 (homework analysis
 * shape) so the portal can be built before the backend `staff/` module exists. They are the ONE
 * deliberate exception to the "never hand-author contract types" rule, and only because the backend
 * has not yet published `/staff/*` in `openapi.json`.
 *
 * MIGRATION: once the backend ships the staff endpoints, run `npm run gen:api` and replace these with
 * aliases over the generated `operations` (see the family `-web` app's `lib/types.ts` for the pattern).
 * Keep the names stable so call sites don't churn.
 */

/** Structured homework vision output (backend SPEC §10). The LLM produces a draft of this; the
 *  reviewer's verdict is an authoritative copy of the same shape. */
export interface HomeworkAnalysisItem {
  prompt: string;
  childAnswer: string;
  correct: boolean;
  /** e.g. 'vowel_ei', 'letter_discrimination' — null/absent when the item is correct. */
  errorType?: string | null;
}

export interface HomeworkAnalysis {
  topic: string;
  exerciseType: string;
  items: HomeworkAnalysisItem[];
  /** Skill tags the next generated lecture should target. */
  suggestedFocus: string[];
}

export type ReviewDecision = 'approved' | 'corrected' | 'rejected';

/** The logged-in reviewer (GET /staff/me). */
export interface StaffMe {
  reviewerId: string;
  name: string;
  role: 'reviewer' | 'admin';
}

/** A pending_review item as seen in the queue — PSEUDONYMISED (ARCHITECTURE §1a):
 *  no child name, parent email, chat, or billing. */
export interface QueueItem {
  uploadId: string;
  /** Opaque, stable handle for the child profile — never a real name. */
  profileHandle: string;
  /** Coarse band, e.g. "1. Klasse" — never an exact age/DOB. */
  gradeBand: string;
  skillTags: string[];
  /** Short-lived per-upload SAS for the homework photo. */
  imageUrl: string;
  /** The LLM DRAFT to validate against (never applied on its own). */
  llmAnalysis: HomeworkAnalysis;
  createdAt: string;
}

export interface QueuePage {
  items: QueueItem[];
  nextCursor: string | null;
}

export interface ClaimResponse {
  uploadId: string;
  /** ISO timestamp the soft-lock lease expires. */
  claimedUntil: string;
}

export interface ReviewSubmitBody {
  decision: ReviewDecision;
  /** Required for 'approved' | 'corrected'; omitted for 'rejected'. */
  reviewedAnalysis?: HomeworkAnalysis;
  /** Optional QA note — never child-identifying. */
  notes?: string;
}

export interface ReviewSubmitResponse {
  /** New upload status after the verdict. */
  status: 'reviewed' | 'rejected';
}
