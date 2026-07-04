/**
 * Staff wire types, derived entirely from the backend OpenAPI via `src/lib/api.gen.ts`
 * (regenerate with `npm run gen:api`). Nothing here is hand-authored — these are ergonomic aliases
 * over the generated `operations`, so the portal stays in lockstep with the shipped `/staff/*` contract
 * (AGENTS rule: never hand-author contract types). Names are kept stable so call sites don't churn.
 */
import type { operations } from './api.gen';

type JsonOf<T> = T extends { content: { 'application/json': infer J } } ? J : never;
/** The application/json body of an operation's (single) documented 2xx response. */
type ResponseOf<Op> = Op extends { responses: infer R } ? { [S in keyof R]: JsonOf<R[S]> }[keyof R] : never;
/** The application/json request body of an operation. */
type BodyOf<Op> = Op extends { requestBody?: infer B } ? JsonOf<B> : never;

/** The logged-in reviewer (GET /staff/me). */
export type StaffMe = ResponseOf<operations['StaffController_me']>;

/** A pending_review queue page — PSEUDONYMISED (ARCHITECTURE §1a). */
export type QueuePage = ResponseOf<operations['StaffController_queue']>;
export type QueueItem = QueuePage['items'][number];

/** Structured homework vision output (backend SPEC §10): the LLM draft and the reviewer's verdict. */
export type HomeworkAnalysis = QueueItem['llmAnalysis'];
export type HomeworkAnalysisItem = HomeworkAnalysis['items'][number];

export type ClaimResponse = ResponseOf<operations['StaffController_claim']>;

export type ReviewSubmitBody = BodyOf<operations['StaffController_submit']>;
export type ReviewSubmitResponse = ResponseOf<operations['StaffController_submit']>;
export type ReviewDecision = NonNullable<ReviewSubmitBody['decision']>;

/** User administration (admin role only; backend SPEC §6) — identity-bearing, NOT pseudonymised. */
export type AdminUserPage = ResponseOf<operations['StaffUsersController_list']>;
export type AdminUser = AdminUserPage['items'][number];
export type AccountStatus = AdminUser['status'];

/** Learner progress (admin role only). Identity-bearing per account; pseudonymised per upload. */
export type UserProgress = ResponseOf<operations['StaffUsersController_accountProgress']>;
export type QueueProgress = ResponseOf<operations['StaffController_queueProgress']>;
export type ProfileProgress = UserProgress['profiles'][number];

/** Lexeme foundation curation (admin role only; backend SPEC §6). */
export type LexemePage = ResponseOf<operations['StaffLexemesController_list']>;
export type Lexeme = LexemePage['items'][number];
export type LexemeEditBody = BodyOf<operations['StaffLexemesController_edit']>;
export type LexemeCreateBody = BodyOf<operations['StaffLexemesController_add']>;
export type LexemeExportResult = ResponseOf<operations['StaffLexemesController_export']>;
export type LexemeStats = ResponseOf<operations['StaffLexemesController_stats']>;
