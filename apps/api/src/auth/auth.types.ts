import type { FamilyRoleValue } from '@fh/shared';

/** Attached to the request by AuthGuard once a session resolves. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  families: Array<{
    familyId: string;
    name: string;
    role: FamilyRoleValue;
    claimedMemberId: string | null;
  }>;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Present only on authenticated requests. */
    authUser?: AuthenticatedUser;
    /** The Session row id, so logout can revoke exactly this device. */
    authSessionId?: string;
  }
}

export const SESSION_COOKIE = 'fh_session';