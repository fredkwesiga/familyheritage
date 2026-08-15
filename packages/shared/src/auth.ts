import { z } from 'zod';

/**
 * Authentication contracts. Shared so the API validates and the login form
 * validates against exactly the same rules - no drift between the error the
 * user sees while typing and the error the server returns on submit.
 */

export const familyRoleSchema = z.enum(['OWNER', 'ADMIN', 'CONTRIBUTOR', 'VIEWER']);
export type FamilyRoleValue = z.infer<typeof familyRoleSchema>;

/**
 * Minimum length only - no "must contain a symbol" rule.
 *
 * NIST SP 800-63B explicitly recommends against composition rules: they push
 * people toward Password1! and toward writing passwords down, without adding
 * meaningful entropy. Length is what matters. Our users include relatives in
 * their seventies, and every needless rejection is a family member who gives up.
 */
export const PASSWORD_MIN_LENGTH = 10;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(254);

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(200, 'Password must be at most 200 characters');

export const registerInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(100).optional(),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: emailSchema,
  // Not passwordSchema: an existing password predates any rule change, and
  // telling an attacker "too short" on login leaks information.
  password: z.string().min(1, 'Enter your password'),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const emailOnlyInputSchema = z.object({ email: emailSchema });
export type EmailOnlyInput = z.infer<typeof emailOnlyInputSchema>;

export const tokenInputSchema = z.object({
  token: z.string().min(20).max(200),
});
export type TokenInput = z.infer<typeof tokenInputSchema>;

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;

/** A family the signed-in user belongs to, with their role in it. */
export const sessionFamilySchema = z.object({
  familyId: z.string().uuid(),
  name: z.string(),
  role: familyRoleSchema,
  claimedMemberId: z.string().uuid().nullable(),
});
export type SessionFamily = z.infer<typeof sessionFamilySchema>;

export const sessionUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  emailVerified: z.boolean(),
  families: z.array(sessionFamilySchema),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const authResponseSchema = z.object({ user: sessionUserSchema });
export type AuthResponse = z.infer<typeof authResponseSchema>;

/**
 * Returned by every endpoint that sends an email.
 *
 * Always 202 with this body, whether or not the address belongs to an account.
 * Anything else turns the endpoint into an account-existence oracle - and in
 * this product, confirming that an address is registered leaks that someone is
 * documenting their family.
 */
export const acceptedResponseSchema = z.object({ accepted: z.literal(true) });
export type AcceptedResponse = z.infer<typeof acceptedResponseSchema>;

export const okResponseSchema = z.object({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof okResponseSchema>;