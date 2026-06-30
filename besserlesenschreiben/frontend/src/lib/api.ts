/**
 * Transport-only API client (AGENTS golden rule 2: no JSX, no UI here). Wraps `fetch`, attaches the
 * bearer token, and normalises the backend's single error envelope `{error:{code,message,...}}`
 * (ARCHITECTURE §5) into a thrown `ApiError`. Endpoint wrappers live in `endpoints.ts`; their request/
 * response types mirror `../backend/SPEC.md §6` and will be regenerated via `npm run gen:api`.
 */

const BASE: string = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000/api/v1';

// Token kept in memory only (SPEC §1: no localStorage; prefer the backend httpOnly cookie when available).
let authToken: string | null = null;
export function setAuthToken(token: string | null): void {
  authToken = token;
}

/**
 * Cross-cutting status handlers (ARCHITECTURE §5). Registered once from inside the router so transport
 * stays UI-free: 401/SESSION_EXPIRED clears auth + redirects to login; 402 routes the parent to the
 * supporter screen. Set via setApiHandlers from <ApiErrorBridge>.
 */
export interface ApiHandlers {
  onUnauthorized?: () => void;
  onPaymentRequired?: () => void;
}
let handlers: ApiHandlers = {};
export function setApiHandlers(next: ApiHandlers): void {
  handlers = next;
}

export interface ApiErrorDetail {
  field: string;
  issue: string;
}

/** Thrown for every non-2xx response. `code` is the backend's stable error code (e.g. 'RATE_LIMITED'). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'include',
    signal: opts.signal,
  });

  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const envelope = (data as { error?: Partial<ApiError> } | null)?.error;
    // Cross-cutting routing before the caller sees the error.
    if (res.status === 401 || envelope?.code === 'SESSION_EXPIRED') handlers.onUnauthorized?.();
    if (res.status === 402) handlers.onPaymentRequired?.();
    throw new ApiError(
      res.status,
      envelope?.code ?? 'INTERNAL',
      envelope?.message ?? 'Etwas ist schiefgelaufen.',
      envelope?.requestId,
      envelope?.details,
    );
  }

  return data as T;
}

/**
 * POST multipart/form-data (e.g. a homework photo). Mirrors apiFetch's error handling, but lets the
 * browser set the multipart boundary — so it must NOT send a JSON content-type.
 */
export async function uploadFile<T>(path: string, form: FormData, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { ...(authToken ? { authorization: `Bearer ${authToken}` } : {}) },
    body: form,
    credentials: 'include',
    signal,
  });

  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const envelope = (data as { error?: Partial<ApiError> } | null)?.error;
    if (res.status === 401 || envelope?.code === 'SESSION_EXPIRED') handlers.onUnauthorized?.();
    if (res.status === 402) handlers.onPaymentRequired?.();
    throw new ApiError(
      res.status,
      envelope?.code ?? 'INTERNAL',
      envelope?.message ?? 'Etwas ist schiefgelaufen.',
      envelope?.requestId,
      envelope?.details,
    );
  }

  return data as T;
}
