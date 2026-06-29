/**
 * Transport-only API client for the STAFF realm (AGENTS rule: no JSX, no UI here). Wraps `fetch`,
 * sends the staff httpOnly cookie (`credentials:'include'`), and normalises the backend's single error
 * envelope `{error:{code,message,...}}` (ARCHITECTURE §5) into a thrown `ApiError`.
 *
 * The staff session JWT lives in an httpOnly cookie on the disjoint staff realm (ARCHITECTURE §1a) —
 * the SPA holds no token in JS and derives auth from a `/staff/me` probe. Endpoint wrappers live in
 * `endpoints.ts`; their types come from `contract.ts` (provisional until the backend publishes `/staff/*`
 * in `openapi.json`, then regenerated via `npm run gen:api`).
 */

const BASE: string = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000/api/v1';

/**
 * Cross-cutting status handler (ARCHITECTURE §5). Registered once from inside the router so transport
 * stays UI-free: 401/SESSION_EXPIRED clears auth + redirects to the staff login. Set via setApiHandlers
 * from <ApiErrorBridge>.
 */
export interface ApiHandlers {
  onUnauthorized?: () => void;
}
let handlers: ApiHandlers = {};
export function setApiHandlers(next: ApiHandlers): void {
  handlers = next;
}

export interface ApiErrorDetail {
  field: string;
  issue: string;
}

/** Thrown for every non-2xx response. `code` is the backend's stable error code (e.g. 'CONFLICT'). */
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
    headers: { 'content-type': 'application/json' },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'include',
    signal: opts.signal,
  });

  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const envelope = (data as { error?: Partial<ApiError> } | null)?.error;
    if (res.status === 401 || envelope?.code === 'SESSION_EXPIRED') handlers.onUnauthorized?.();
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
