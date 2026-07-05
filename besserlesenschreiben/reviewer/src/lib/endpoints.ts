import { apiFetch } from './api';

/** Which slice of the review pipeline to list (mirrors the backend). */
export type QueueFilter = 'open' | 'done' | 'all';
import type {
  AccountStatus,
  AdminUser,
  AdminUserPage,
  ClaimResponse,
  Lexeme,
  LexemeCreateBody,
  LexemeEditBody,
  LexemeExportResult,
  LexemePage,
  LexemeStats,
  QueuePage,
  QueueProgress,
  ReviewSubmitBody,
  ReviewSubmitResponse,
  StaffMe,
  UserProgress,
} from './contract';

/**
 * Typed endpoint wrappers over the transport client for the STAFF realm (`../backend/SPEC.md §6`).
 * Request/response types come from `./contract` (provisional — regenerate via `npm run gen:api` once
 * the backend publishes `/staff/*`).
 */

export const staffAuthApi = {
  /** Always resolves (the backend never reveals whether a staff email exists). */
  requestCode: (email: string) =>
    apiFetch<{ ok: true }>('/staff/auth/request-code', { method: 'POST', body: { email } }),

  /** On success the backend sets an httpOnly staff cookie; the SPA ignores any body token. */
  verify: (email: string, code: string) =>
    apiFetch<StaffMe>('/staff/auth/verify', { method: 'POST', body: { email, code } }),

  /** Clears the httpOnly staff cookie (only the server can). */
  logout: () => apiFetch<{ ok: true }>('/staff/auth/logout', { method: 'POST', body: {} }),

  me: () => apiFetch<StaffMe>('/staff/me'),
};

export const reviewApi = {
  /** Review items, pseudonymised + cursor-paged (ARCHITECTURE §1a). `status`: open (default) | done | all. */
  queue: (params: { limit?: number; cursor?: string; status?: QueueFilter } = {}) => {
    const q = new URLSearchParams();
    if (params.limit !== undefined) q.set('limit', String(params.limit));
    if (params.cursor) q.set('cursor', params.cursor);
    if (params.status) q.set('status', params.status);
    const qs = q.toString();
    return apiFetch<QueuePage>(`/staff/queue${qs ? `?${qs}` : ''}`);
  },

  /** Soft-lock an item so two reviewers don't grade it twice (409 if already held). */
  claim: (uploadId: string) =>
    apiFetch<ClaimResponse>(`/staff/queue/${encodeURIComponent(uploadId)}/claim`, {
      method: 'POST',
      body: {},
    }),

  /** Release my own claim when leaving the review screen without a verdict (idempotent no-op otherwise). */
  release: (uploadId: string) =>
    apiFetch<{ ok: true }>(`/staff/queue/${encodeURIComponent(uploadId)}/release`, { method: 'POST', body: {} }),

  /** Submit the authoritative verdict. approve/correct apply it; reject mutates nothing. */
  submit: (uploadId: string, body: ReviewSubmitBody) =>
    apiFetch<ReviewSubmitResponse>(`/staff/reviews/${encodeURIComponent(uploadId)}`, {
      method: 'POST',
      body,
    }),

  /** Pseudonymised learner progress for a queued upload (admin only) — review context, never a name. */
  progress: (uploadId: string) =>
    apiFetch<QueueProgress>(`/staff/queue/${encodeURIComponent(uploadId)}/progress`),
};

/**
 * User administration (backend SPEC §6) — ADMIN role only, identity-bearing (real family email + status).
 * The owner's approval/control surface, kept separate from the pseudonymised review queue. A plain reviewer
 * gets 403 on every call here.
 */
export const usersApi = {
  list: (params: { status?: AccountStatus; limit?: number; cursor?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.limit !== undefined) q.set('limit', String(params.limit));
    if (params.cursor) q.set('cursor', params.cursor);
    const qs = q.toString();
    return apiFetch<AdminUserPage>(`/staff/users${qs ? `?${qs}` : ''}`);
  },

  /** pending|deactivated → active; releases the first login code by email. */
  approve: (accountId: string) =>
    apiFetch<{ accountId: string; status: AdminUser['status'] }>(
      `/staff/users/${encodeURIComponent(accountId)}/approve`,
      { method: 'POST', body: {} },
    ),

  /** Block login (reversible); data retained. Takes effect immediately. */
  deactivate: (accountId: string) =>
    apiFetch<{ accountId: string; status: AdminUser['status'] }>(
      `/staff/users/${encodeURIComponent(accountId)}/deactivate`,
      { method: 'POST', body: {} },
    ),

  /** Permanent erasure: DB rows + the account's blobs. Returns 204. */
  remove: (accountId: string) =>
    apiFetch<void>(`/staff/users/${encodeURIComponent(accountId)}`, { method: 'DELETE' }),

  /** Identity-bearing learner progress for one account's children (admin only). */
  progress: (accountId: string) =>
    apiFetch<UserProgress>(`/staff/users/${encodeURIComponent(accountId)}/progress`),
};

/**
 * Lexeme foundation curation (backend SPEC §6) — ADMIN role only. Edit the annotated word pool that
 * grounds lecture generation. Edits land in the live table immediately; `export` persists the change-set
 * to the committed lexeme.overrides.json so corrections survive reseeds and reproduce in any fresh DB.
 */
/** Filter params for the lexeme browser + stats (all optional; empty values are dropped). */
export interface LexemeFilters {
  search?: string;
  skill?: string;
  pos?: string;
  genus?: string; // der | die | das | none
  ageBand?: string; // 6-7 | 8-9 | none
  source?: string; // rwe2015 | reviewer
  feature?: string; // an orthographic feature key that must be present
  hkMin?: string;
  hkMax?: string;
  syl?: string; // exact syllable count
  morph?: string; // exact morpheme count
  lernwort?: string; // '' | 'true' | 'false'
  trennbar?: string;
  merkwort?: string;
}

function toQuery(params: object): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const lexemesApi = {
  list: (params: LexemeFilters & { limit?: number; cursor?: string } = {}) =>
    apiFetch<LexemePage>(`/staff/lexemes${toQuery(params)}`),

  /** Aggregate stats over the same filter — total + breakdowns by property. */
  stats: (filters: LexemeFilters = {}) => apiFetch<LexemeStats>(`/staff/lexemes/stats${toQuery(filters)}`),

  /** Field-level edit — only the provided fields change. */
  edit: (lemma: string, body: LexemeEditBody) =>
    apiFetch<Lexeme>(`/staff/lexemes/${encodeURIComponent(lemma)}`, { method: 'PATCH', body }),

  /** Add a new word (409 if the lemma already exists). */
  add: (body: LexemeCreateBody) => apiFetch<Lexeme>('/staff/lexemes', { method: 'POST', body }),

  /** Remove a word. Returns 204. */
  remove: (lemma: string) =>
    apiFetch<void>(`/staff/lexemes/${encodeURIComponent(lemma)}`, { method: 'DELETE' }),

  /** Persist current corrections to the committed lexeme.overrides.json; returns the change counts. */
  export: () => apiFetch<LexemeExportResult>('/staff/lexemes/export', { method: 'POST', body: {} }),
};
