import { apiFetch } from './api';

/** Which slice of the review pipeline to list (mirrors the backend). */
export type QueueFilter = 'open' | 'done' | 'all';
import type {
  AccountStatus,
  AdminUser,
  AdminUserPage,
  ClaimResponse,
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

  /** Update the caller's own display name (profile page). */
  updateMe: (name: string) => apiFetch<StaffMe>('/staff/me', { method: 'PATCH', body: { name } }),
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
  list: (params: { status?: AccountStatus; limit?: number; cursor?: string; q?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.cursor) query.set('cursor', params.cursor);
    if (params.q) query.set('q', params.q); // email search fragment (case-insensitive contains)
    const qs = query.toString();
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

  /** Identity-bearing learner progress for one account's students (admin only). */
  progress: (accountId: string) =>
    apiFetch<UserProgress>(`/staff/users/${encodeURIComponent(accountId)}/progress`),
};
