import type { CookieSerializeOptions } from '@fastify/cookie';

/**
 * Session cookie policy.
 *
 * httpOnly  - JavaScript cannot read it, so an XSS bug cannot steal the session.
 * sameSite  - 'lax' blocks cross-site POSTs while still allowing a magic-link
 *             click from an email client to arrive authenticated.
 * secure    - HTTPS only, except on localhost where there is no certificate.
 * path      - '/' so the cookie is sent to every API route.
 */
export function sessionCookieOptions(
  isProduction: boolean,
  expiresAt?: Date,
): CookieSerializeOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    ...(expiresAt ? { expires: expiresAt } : { maxAge: 0 }),
  };
}