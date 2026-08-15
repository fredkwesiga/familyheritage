import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * 32 bytes of CSPRNG output, base64url encoded (43 chars, no padding, safe in
 * a URL and in a cookie).
 */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Tokens are stored hashed, never in plaintext.
 *
 * SHA-256 with no salt and no pepper is correct here, unlike for passwords: the
 * input is already 256 bits of uniform randomness, so there is no dictionary to
 * attack and no need to make hashing slow. Salting would only break the ability
 * to look the token up by its hash.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time comparison for any place a hash is compared in application code. */
export function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}