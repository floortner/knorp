import { apiFetch } from './api';
import type {
  AccountStatus,
  AdminUser,
  AdminUserPage,
  ClaimResponse,
  QueuePage,
  ReviewSubmitBody,
  ReviewSubmitResponse,
  StaffMe,
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
  /** The pending_review queue, pseudonymised + cursor-paged (ARCHITECTURE §1a). */
  queue: (params: { limit?: number; cursor?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.limit !== undefined) q.set('limit', String(params.limit));
    if (params.cursor) q.set('cursor', params.cursor);
    const qs = q.toString();
    return apiFetch<QueuePage>(`/staff/queue${qs ? `?${qs}` : ''}`);
  },

  /** Soft-lock an item so two reviewers don't grade it twice (409 if already held). */
  claim: (uploadId: string) =>
    apiFetch<ClaimResponse>(`/staff/queue/${encodeURIComponent(uploadId)}/claim`, {
      method: 'POST',
      body: {},
    }),

  /** Submit the authoritative verdict. approve/correct apply it; reject mutates nothing. */
  submit: (uploadId: string, body: ReviewSubmitBody) =>
    apiFetch<ReviewSubmitResponse>(`/staff/reviews/${encodeURIComponent(uploadId)}`, {
      method: 'POST',
      body,
    }),
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
};
