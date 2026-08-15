import {
  acceptedResponseSchema,
  authResponseSchema,
  okResponseSchema,
  type EmailOnlyInput,
  type LoginInput,
  type PasswordResetConfirmInput,
  type RegisterInput,
  type SessionUser,
} from '@fh/shared';
import { ApiError, apiRequest } from '@/lib/api-client';

/** One key for the signed-in user. Everything auth-related invalidates this. */
export const sessionQueryKey = ['auth', 'session'] as const;

/**
 * Reads the current session.
 *
 * A 401 here is not an error - it is the answer "nobody is signed in". Letting
 * it throw would put every visitor's first page load into an error state.
 */
export async function fetchSession(): Promise<SessionUser | null> {
  try {
    const { user } = await apiRequest('/auth/me', authResponseSchema);
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function login(body: LoginInput): Promise<SessionUser> {
  const { user } = await apiRequest('/auth/login', authResponseSchema, {
    method: 'POST',
    body,
  });
  return user;
}

export async function register(body: RegisterInput): Promise<SessionUser> {
  const { user } = await apiRequest('/auth/register', authResponseSchema, {
    method: 'POST',
    body,
  });
  return user;
}

export async function logout(): Promise<void> {
  await apiRequest('/auth/logout', okResponseSchema, { method: 'POST' });
}

export async function requestMagicLink(body: EmailOnlyInput): Promise<void> {
  await apiRequest('/auth/magic-link', acceptedResponseSchema, { method: 'POST', body });
}

export async function verifyMagicLink(token: string): Promise<SessionUser> {
  const { user } = await apiRequest('/auth/magic-link/verify', authResponseSchema, {
    method: 'POST',
    body: { token },
  });
  return user;
}

export async function requestPasswordReset(body: EmailOnlyInput): Promise<void> {
  await apiRequest('/auth/password-reset/request', acceptedResponseSchema, {
    method: 'POST',
    body,
  });
}

export async function confirmPasswordReset(body: PasswordResetConfirmInput): Promise<void> {
  await apiRequest('/auth/password-reset/confirm', okResponseSchema, { method: 'POST', body });
}

export async function verifyEmail(token: string): Promise<void> {
  await apiRequest('/auth/verify-email', okResponseSchema, { method: 'POST', body: { token } });
}