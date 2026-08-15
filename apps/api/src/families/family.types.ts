import type { FamilyRoleValue } from '@fh/shared';

/**
 * Established by FamilyMembershipGuard and attached to the request.
 *
 * Every downstream service takes its familyId from here, never from the client
 * and never from a token. Memberships change; tokens do not.
 */
export interface FamilyContext {
  familyId: string;
  familyName: string;
  role: FamilyRoleValue;
  membershipId: string;
  /** The Member row this user has claimed as themselves, if any. */
  claimedMemberId: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    familyContext?: FamilyContext;
  }
}