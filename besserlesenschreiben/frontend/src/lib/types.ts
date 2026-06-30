/**
 * Wire types for the app, derived entirely from the backend OpenAPI via `src/lib/api.gen.ts`
 * (regenerate with `npm run gen:api`). Nothing here is hand-authored — these are ergonomic aliases
 * over the generated `operations`, so the frontend stays in lockstep with the contract (AGENTS rule 1).
 */
import type { operations } from './api.gen';

type JsonOf<T> = T extends { content: { 'application/json': infer J } } ? J : never;
/** The application/json body of an operation's (single) documented 2xx response. */
type ResponseOf<Op> = Op extends { responses: infer R } ? { [S in keyof R]: JsonOf<R[S]> }[keyof R] : never;
/** The application/json request body of an operation. */
type BodyOf<Op> = Op extends { requestBody?: infer B } ? JsonOf<B> : never;

export type Me = ResponseOf<operations['ProfilesController_getMe']>;
export type Profile = Me['profiles'][number];

export type Unit = ResponseOf<operations['SessionsController_units']>[number];
export type UnitStatus = Unit['status'];

export type SessionResponse = ResponseOf<operations['SessionsController_create']>;
export type Exercise = SessionResponse['items'][number];
/** @deprecated use Exercise — kept so existing imports compile during the M5 build-out. */
export type SessionItem = Exercise;

export type SessionComplete = ResponseOf<operations['SessionsController_complete']>;
export type Progress = ResponseOf<operations['ProgressController_get']>;

export type VerifyResponse = ResponseOf<operations['AuthController_verify']>;

export type CreateProfileBody = BodyOf<operations['ProfilesController_create']>;
export type Buddy = NonNullable<CreateProfileBody['buddy']>;
export type CreateAttemptBody = BodyOf<operations['AttemptsController_record']>;
export type UpdateSettingsBody = BodyOf<operations['ProfilesController_updateSettings']>;

export type ChatHistory = ResponseOf<operations['ChatController_history']>;
export type ChatMessage = ChatHistory['messages'][number];
export type ChatReply = ResponseOf<operations['ChatController_send']>;
export type SendChatBody = BodyOf<operations['ChatController_send']>;
