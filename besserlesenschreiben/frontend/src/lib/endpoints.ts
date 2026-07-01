import { apiFetch, uploadFile } from './api';
import type {
  ChatHistory,
  ChatReply,
  CreateProfileBody,
  HomeworkResult,
  HomeworkUploadResponse,
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

  /** `source:'llm'` requests a generated lecture (teaching intro + fresh exercises); default is bank. */
  createSession: (profileId: string, unit?: number, source?: 'bank' | 'llm') =>
    apiFetch<SessionResponse>('/sessions', {
      method: 'POST',
      body: { profileId, ...(unit !== undefined ? { unit } : {}), ...(source ? { source } : {}) },
    }),

  completeSession: (sessionId: string) =>
    apiFetch<SessionComplete>(`/sessions/${encodeURIComponent(sessionId)}/complete`, {
      method: 'POST',
      body: {},
    }),
};

/** Homework "Foto & verbessern": upload a photo, then poll its status (family sees the result only). */
export const homeworkApi = {
  upload: (profileId: string, file: File) => {
    const form = new FormData();
    form.append('profileId', profileId);
    form.append('image', file);
    return uploadFile<HomeworkUploadResponse>('/homework', form);
  },

  status: (uploadId: string) => apiFetch<HomeworkResult>(`/homework/${encodeURIComponent(uploadId)}`),
};

/** Trainer chat (free AI). History + send, both scoped to the child profile. */
export const chatApi = {
  history: (profileId: string) => apiFetch<ChatHistory>(`/chat/${encodeURIComponent(profileId)}`),

  send: (profileId: string, text: string) =>
    apiFetch<ChatReply>(`/chat/${encodeURIComponent(profileId)}`, { method: 'POST', body: { text } }),
};

/**
 * Parent-area endpoints. verify-pin binds the parentToken to ONE child (profileId is signed into the
 * token), so the destructive calls just carry the token as a per-request Bearer — no profileId in the
 * body, and no global token mutation.
 */
export const parentApi = {
  setPin: (pin: string) =>
    apiFetch<{ ok: true }>('/parent/set-pin', { method: 'POST', body: { pin } }),

  verifyPin: (pin: string, profileId: string) =>
    apiFetch<{ parentToken: string }>('/parent/verify-pin', { method: 'POST', body: { pin, profileId } }),

  reset: (parentToken: string) =>
    apiFetch<{ ok: true }>('/parent/reset', { method: 'POST', body: {}, token: parentToken }),
};
