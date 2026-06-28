import type { FastifyReply } from 'fastify';

/** Session JWT delivered as an httpOnly cookie (SPEC §4) — survives refresh, kept out of JS. */
export const SESSION_COOKIE = 'session';

const MAX_AGE_S = 30 * 24 * 60 * 60; // 30d, matches the JWT TTL

export function sessionCookieOptions(isProd: boolean) {
  return { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/', maxAge: MAX_AGE_S };
}

export function clearSessionCookie(reply: FastifyReply, isProd: boolean): void {
  reply.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/' });
}
