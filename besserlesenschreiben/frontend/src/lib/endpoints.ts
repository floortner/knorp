import { apiFetch } from './api';
import type {
  CreateProfileBody,
  Me,
  Profile,
  SessionComplete,
  SessionResponse,
  Unit,
  VerifyResponse,
} from './types';

/**
 * Typed endpoint wrappers over the transport client. Request/response types come from the generated
 * contract (`./types` → `./api.gen.ts`); re-run `npm run gen:api` after a backend contract change.
 */

export type { Buddy, CreateProfileBody } from './types';

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

  completeSession: (sessionId: string) =>
    apiFetch<SessionComplete>(`/sessions/${encodeURIComponent(sessionId)}/complete`, {
      method: 'POST',
      body: {},
    }),
};
