import { apiFetch } from './api';
import type { Me, Profile, SessionResponse, Unit } from './types';

export type Buddy = 'nepo' | 'stella';

export interface CreateProfileBody {
  name: string;
  buddy?: Buddy;
  goal?: number;
}

/**
 * Typed endpoint wrappers mirroring `../backend/SPEC.md §6`. These hand-written shapes are a stopgap
 * until `npm run gen:api` generates them from the backend OpenAPI — keep them in lockstep with the
 * contract (AGENTS golden rule 1).
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

export const coreApi = {
  me: () => apiFetch<Me>('/me'),

  createProfile: (body: CreateProfileBody) =>
    apiFetch<{ profile: Profile }>('/profiles', { method: 'POST', body }),

  units: (profileId: string) =>
    apiFetch<Unit[]>(`/units?profileId=${encodeURIComponent(profileId)}`),

  createSession: (profileId: string, unit?: number) =>
    apiFetch<SessionResponse>('/sessions', {
      method: 'POST',
      body: { profileId, ...(unit !== undefined ? { unit } : {}) },
    }),
};
