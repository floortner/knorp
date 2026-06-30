import type { FastifyReply } from 'fastify';

/**
 * Staff session JWT delivered as an httpOnly cookie on the DISJOINT staff realm (ARCHITECTURE §1a).
 * Distinct cookie name AND path from the family `session` cookie so the browser never sends a staff
 * cookie to family routes (or vice-versa), and the two can't be confused. Path is the staff route prefix.
 */
export const STAFF_COOKIE = 'staff_session';

/** Staff sessions are short-lived — staff handle minors' data, so re-auth often. Matches the JWT TTL. */
export const STAFF_SESSION_TTL = '12h';
const MAX_AGE_S = 12 * 60 * 60;

/** The cookie is scoped to the staff route prefix (global prefix `api/v1` + `/staff`). */
const STAFF_PATH = '/api/v1/staff';

export function staffCookieOptions(isProd: boolean) {
  return { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: STAFF_PATH, maxAge: MAX_AGE_S };
}

export function clearStaffCookie(reply: FastifyReply, isProd: boolean): void {
  reply.clearCookie(STAFF_COOKIE, { httpOnly: true, secure: isProd, sameSite: 'lax', path: STAFF_PATH });
}
