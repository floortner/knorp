import { apiFetch } from './api';
import type {
  CreateProfileBody,
  Me,
  Profile,
  Progress,
  SessionComplete,
  SessionResponse,
  Unit,
  UpdateSettingsBody,
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

  /** On success the backend sets an httpOnly session cookie; the SPA ignores the body token. */
  verify: (email: string, code: string) =>
    apiFetch<VerifyResponse>('/auth/verify', { method: 'POST', body: { email, code } }),

  /** Clears the httpOnly session cookie (only the server can). */
  logout: () => apiFetch<{ ok: true }>('/auth/logout', { method: 'POST', body: {} }),
};

export const coreApi = {
  me: () => apiFetch<Me>('/me'),

  createProfile: (body: CreateProfileBody) =>
    apiFetch<{ profile: Profile }>('/profiles', { method: 'POST', body }),

  updateSettings: (profileId: string, body: UpdateSettingsBody) =>
    apiFetch<{ profile: Profile }>(`/profiles/${encodeURIComponent(profileId)}/settings`, {
      method: 'PATCH',
      body,
    }),

  progress: (profileId: string) =>
    apiFetch<Progress>(`/progress/${encodeURIComponent(profileId)}`),

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
