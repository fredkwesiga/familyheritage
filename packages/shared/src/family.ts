import { z } from 'zod';
import { familyRoleSchema } from './auth.js';

/**
 * Family contracts.
 *
 * A family is the tenant boundary: every authorisation decision in the product
 * starts by asking which family a request is for, and whether this user belongs
 * to it.
 */

export const createFamilyInputSchema = z.object({
  name: z.string().trim().min(1, 'Give your family a name').max(120),
  description: z.string().trim().max(500).optional(),
});
export type CreateFamilyInput = z.infer<typeof createFamilyInputSchema>;

export const kinshipStyleSchema = z.enum(['WESTERN', 'CLASSIFICATORY']);
export type KinshipStyleValue = z.infer<typeof kinshipStyleSchema>;

export const KINSHIP_STYLE_LABELS: Record<KinshipStyleValue, { label: string; hint: string }> = {
  WESTERN: {
    label: 'Cousins and removes',
    hint: 'Your parent\u2019s cousin is your \u201cfirst cousin once removed\u201d.',
  },
  CLASSIFICATORY: {
    label: 'Uncles, aunts and siblings',
    hint: 'Your parent\u2019s cousin is your uncle or aunt, and your cousins are your brothers and sisters.',
  },
};

export const updateFamilyInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).nullable(),
    /// When true, VIEWERs see living members' names only - no dates, no
    /// biography. Family history is inherently a disclosure of other living
    /// people's personal data, so this defaults to on.
    hideLivingFromViewers: z.boolean(),
    /// Per-family AI switch. Off by default, independent of the server-side
    /// AI_ENABLED environment flag. Both must be true for AI to run.
    aiEnabled: z.boolean(),
    /// How this family names its relatives. Changes wording only.
    kinshipStyle: kinshipStyleSchema,
  })
  .partial()
  .refine((values) => Object.keys(values).length > 0, {
    message: 'Nothing to update',
  });
export type UpdateFamilyInput = z.infer<typeof updateFamilyInputSchema>;

export const familySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  hideLivingFromViewers: z.boolean(),
  aiEnabled: z.boolean(),
  kinshipStyle: kinshipStyleSchema,
  memberCount: z.number().int().nonnegative(),
  /// The role of the user who made the request. The UI uses this to decide what
  /// to render; the API never trusts it back.
  yourRole: familyRoleSchema,
  yourClaimedMemberId: z.string().uuid().nullable(),
  createdAt: z.string(),
});
export type Family = z.infer<typeof familySchema>;

export const familySummarySchema = familySchema.pick({
  id: true,
  name: true,
  description: true,
  memberCount: true,
  yourRole: true,
  createdAt: true,
});
export type FamilySummary = z.infer<typeof familySummarySchema>;

export const familyListResponseSchema = z.object({
  families: z.array(familySummarySchema),
});
export type FamilyListResponse = z.infer<typeof familyListResponseSchema>;

export const familyResponseSchema = z.object({ family: familySchema });
export type FamilyResponse = z.infer<typeof familyResponseSchema>;

/** A person who can sign in and see this family. Not a Member in the tree. */
export const familyAccessEntrySchema = z.object({
  userId: z.string().uuid(),
  email: z.string(),
  name: z.string().nullable(),
  role: familyRoleSchema,
  claimedMemberId: z.string().uuid().nullable(),
  joinedAt: z.string(),
  isYou: z.boolean(),
});
export type FamilyAccessEntry = z.infer<typeof familyAccessEntrySchema>;

export const familyAccessListSchema = z.object({
  access: z.array(familyAccessEntrySchema),
});
export type FamilyAccessList = z.infer<typeof familyAccessListSchema>;

export const changeRoleInputSchema = z.object({
  /// OWNER is deliberately absent. Ownership moves through the transfer
  /// endpoint, which is a different operation with a confirmation step - not a
  /// dropdown selection someone can make by accident.
  role: z.enum(['ADMIN', 'CONTRIBUTOR', 'VIEWER']),
});
export type ChangeRoleInput = z.infer<typeof changeRoleInputSchema>;

export const transferOwnershipInputSchema = z.object({
  toUserId: z.string().uuid(),
  /// Typing the family name is the confirmation. This is irreversible by the
  /// person performing it.
  confirmFamilyName: z.string(),
});
export type TransferOwnershipInput = z.infer<typeof transferOwnershipInputSchema>;