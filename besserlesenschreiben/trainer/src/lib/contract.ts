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

/** The logged-in trainer (GET /staff/me). */
export type StaffMe = ResponseOf<operations['StaffController_me']>;

/** A review queue page — student names included (known-trainer model, rule-10 revision §H1.3). */
export type QueuePage = ResponseOf<operations['StaffController_queue']>;
export type QueueItem = QueuePage['items'][number];

/** Structured homework vision output (backend SPEC §10): the LLM draft and the trainer's verdict. */
export type HomeworkAnalysis = QueueItem['llmAnalysis'];
export type HomeworkAnalysisItem = HomeworkAnalysis['items'][number];

export type ClaimResponse = ResponseOf<operations['StaffController_claim']>;

export type ReviewSubmitBody = BodyOf<operations['StaffController_submit']>;
export type ReviewSubmitResponse = ResponseOf<operations['StaffController_submit']>;
export type ReviewDecision = NonNullable<ReviewSubmitBody['decision']>;

/** User administration (admin role only; backend SPEC §6) — additionally account-identity-bearing. */
export type AdminUserPage = ResponseOf<operations['StaffUsersController_list']>;
export type AdminUser = AdminUserPage['items'][number];
export type AccountStatus = AdminUser['status'];

/** Learner progress. Per account (admin only); per upload / per student (all trainers, with name). */
export type UserProgress = ResponseOf<operations['StaffUsersController_accountProgress']>;
export type QueueProgress = ResponseOf<operations['StaffController_queueProgress']>;
export type ProfileProgress = UserProgress['profiles'][number];

/** Learner directory + per-student activity (all trainers; ROADMAP §H1.3 + §H3.1). */
export type StudentPage = ResponseOf<operations['StaffStudentsController_list']>;
export type StudentListItem = StudentPage['items'][number];
export type StudentDetail = ResponseOf<operations['StaffStudentsController_detail']>;
export type StudentSessionPage = ResponseOf<operations['StaffStudentsController_sessions']>;
export type StudentSession = StudentSessionPage['items'][number];
export type SessionSource = StudentSession['source'];
export type StudentSessionDetail = ResponseOf<operations['StaffStudentsController_session']>;
export type StudentAttempt = StudentSessionDetail['attempts'][number];


/** Staff-authored lectures + assignments (all trainers; ROADMAP §H1). */
export type LecturePage = ResponseOf<operations['StaffLecturesController_list']>;
export type LectureListItem = LecturePage['items'][number];
export type LectureStatus = LectureListItem['status'];
export type LectureDetail = ResponseOf<operations['StaffLecturesController_detail']>;
export type LectureItem = LectureDetail['items'][number];
export type LectureUpsertBody = BodyOf<operations['StaffLecturesController_create']>;
export type LectureItemInput = LectureUpsertBody['items'][number];
export type AssignBody = BodyOf<operations['StaffLecturesController_assign']>;
export type AssignResult = ResponseOf<operations['StaffLecturesController_assign']>;
export type LectureAssignmentList = ResponseOf<operations['StaffLecturesController_assignments']>;
export type LectureAssignment = LectureAssignmentList['items'][number];
export type AssignmentStatus = LectureAssignment['status'];
