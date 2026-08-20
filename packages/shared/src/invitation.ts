import { z } from 'zod';
import { familyRoleSchema } from './auth.js';
import { emailSchema } from './auth.js';

/**
 * Invitation contracts.
 *
 * A family archive built by one person is the failure mode this whole product
 * has to avoid: one motivated relative adds twelve people, nobody else
 * contributes, the stories never get written, and the tree becomes a static
 * chart of the dead. Inviting people is the only mechanism against that, so it
 * is designed to be as short a path as possible - one email, one click, and the
 * person lands inside the family rather than on a signup wall.
 */

/** OWNER is absent on purpose: ownership moves only by transfer. */
export const invitableRoleSchema = z.enum(['ADMIN', 'CONTRIBUTOR', 'VIEWER']);
export type InvitableRole = z.infer<typeof invitableRoleSchema>;

export const createInvitationInputSchema = z.object({
  email: emailSchema,
  role: invitableRoleSchema.default('CONTRIBUTOR'),
  /// A line from the person inviting. Included in the email.
  message: z.string().trim().max(500).optional(),
});
export type CreateInvitationInput = z.infer<typeof createInvitationInputSchema>;

export const invitationSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  role: familyRoleSchema,
  invitedByName: z.string().nullable(),
  expiresAt: z.string(),
  createdAt: z.string(),
  /// True once the invitation has passed its expiry without being used.
  isExpired: z.boolean(),
});
export type Invitation = z.infer<typeof invitationSchema>;

export const invitationListResponseSchema = z.object({
  invitations: z.array(invitationSchema),
});
export type InvitationListResponse = z.infer<typeof invitationListResponseSchema>;

export const invitationResponseSchema = z.object({ invitation: invitationSchema });
export type InvitationResponse = z.infer<typeof invitationResponseSchema>;

/**
 * What someone holding an invitation link is shown before they sign in.
 *
 * Deliberately thin: the family's name, who invited them, and the role. Enough
 * to answer "what is this?" without disclosing anything about the family to
 * whoever happens to be holding the link.
 */
export const invitationPreviewSchema = z.object({
  familyName: z.string(),
  invitedByName: z.string().nullable(),
  /// The address it was sent to. Shown so a mismatch is explicable.
  email: z.string(),
  role: familyRoleSchema,
  status: z.enum(['VALID', 'EXPIRED', 'ALREADY_ACCEPTED', 'NOT_FOUND']),
});
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

export const invitationPreviewResponseSchema = z.object({
  preview: invitationPreviewSchema,
});
export type InvitationPreviewResponse = z.infer<typeof invitationPreviewResponseSchema>;

export const acceptInvitationInputSchema = z.object({
  token: z.string().min(20).max(200),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationInputSchema>;

export const acceptInvitationResponseSchema = z.object({
  familyId: z.string().uuid(),
  familyName: z.string(),
});
export type AcceptInvitationResponse = z.infer<typeof acceptInvitationResponseSchema>;

export const INVITE_ROLE_HINTS: Record<InvitableRole, string> = {
  ADMIN: 'Can manage people, records and settings. Choose this for a co-organiser.',
  CONTRIBUTOR: 'Can add relatives, photographs and stories. The right choice for most people.',
  VIEWER: 'Can read the tree and its stories, but change nothing.',
};

/** Seven days. Long enough to reach someone who checks email weekly. */
export const INVITATION_TTL_DAYS = 7;