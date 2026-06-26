import { apiFetch } from './api';

/**
 * Typed endpoint wrappers mirroring `../backend/SPEC.md §6`. These hand-written shapes are a stopgap
 * until `npm run gen:api` generates them from the backend OpenAPI — keep them in lockstep with the
 * contract (AGENTS golden rule 1). Only the endpoints needed so far (M1 auth) are defined.
 */

export interface VerifyResponse {
  token: string;
  isNewAccount: boolean;
}

export const authApi = {
  /** Always resolves (the backend never reveals whether an email exists). */
  requestCode: (email: string) =>
    apiFetch<{ ok: true }>('/auth/request-code', { method: 'POST', body: { email } }),

  verify: (email: string, code: string) =>
    apiFetch<VerifyResponse>('/auth/verify', { method: 'POST', body: { email, code } }),
};
