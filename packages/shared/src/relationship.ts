import { z } from 'zod';
import { approximateDateSchema } from './dates.js';
import { createMemberInputSchema, memberSummarySchema } from './member.js';

/**
 * Relationship contracts.
 *
 * Two edge types and nothing else:
 *   ParentChild  directional, typed, the only place parentage lives
 *   Partnership  symmetric, one canonical row per couple
 *
 * Siblings are NEVER stored. They are derived from shared parents, every time.
 * Storing them would mean resynthesising edges across a whole subtree whenever
 * a parent changes, and the two representations would drift apart.
 */

export const parentRelationTypeSchema = z.enum([
  'BIOLOGICAL',
  'ADOPTIVE',
  'STEP',
  'FOSTER',
  'GUARDIAN',
]);
export type ParentRelationType = z.infer<typeof parentRelationTypeSchema>;

export const certaintySchema = z.enum(['CONFIRMED', 'PROBABLE', 'DISPUTED']);
export type Certainty = z.infer<typeof certaintySchema>;

export const partnershipTypeSchema = z.enum(['MARRIAGE', 'PARTNERSHIP', 'UNION']);
export type PartnershipType = z.infer<typeof partnershipTypeSchema>;

export const partnershipStatusSchema = z.enum([
  'ACTIVE',
  'SEPARATED',
  'DIVORCED',
  'ENDED_BY_DEATH',
]);
export type PartnershipStatus = z.infer<typeof partnershipStatusSchema>;

// ------------------------------------------------------------------ inputs

export const createParentChildInputSchema = z
  .object({
    parentId: z.string().uuid(),
    childId: z.string().uuid(),
    relationType: parentRelationTypeSchema.optional(),
    certainty: certaintySchema.optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.parentId !== value.childId, {
    message: 'Someone cannot be their own parent',
    path: ['childId'],
  });
export type CreateParentChildInput = z.infer<typeof createParentChildInputSchema>;

export const createPartnershipInputSchema = z
  .object({
    memberAId: z.string().uuid(),
    memberBId: z.string().uuid(),
    type: partnershipTypeSchema.optional(),
    status: partnershipStatusSchema.optional(),
    start: approximateDateSchema.optional(),
    end: approximateDateSchema.optional(),
    place: z.string().trim().max(160).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.memberAId !== value.memberBId, {
    message: 'Someone cannot be their own partner',
    path: ['memberBId'],
  });
export type CreatePartnershipInput = z.infer<typeof createPartnershipInputSchema>;

export const updatePartnershipInputSchema = z
  .object({
    type: partnershipTypeSchema,
    status: partnershipStatusSchema,
    start: approximateDateSchema,
    end: approximateDateSchema,
    place: z.string().trim().max(160).nullable(),
    notes: z.string().trim().max(500).nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });
export type UpdatePartnershipInput = z.infer<typeof updatePartnershipInputSchema>;

/**
 * The "Add parent / Add child / Add partner" flow.
 *
 * Creating the person and the link in one call is what keeps the interface
 * simple: the user picks a relationship from a member's own card, so the
 * relationship is implied by where they clicked and never has to be chosen from
 * a dropdown. Relationship pickers are where these products get abandoned.
 */
export const addRelativeInputSchema = z.object({
  relation: z.enum(['PARENT', 'CHILD', 'PARTNER', 'SIBLING']),
  member: createMemberInputSchema,
  /// For PARENT and CHILD links only.
  relationType: parentRelationTypeSchema.optional(),
  /// For PARTNER links only.
  partnershipType: partnershipTypeSchema.optional(),
});
export type AddRelativeInput = z.infer<typeof addRelativeInputSchema>;

// ----------------------------------------------------------------- outputs

export const parentLinkSchema = z.object({
  linkId: z.string().uuid(),
  member: memberSummarySchema,
  relationType: parentRelationTypeSchema,
  certainty: certaintySchema,
  notes: z.string().nullable(),
});
export type ParentLink = z.infer<typeof parentLinkSchema>;

export const partnerLinkSchema = z.object({
  linkId: z.string().uuid(),
  member: memberSummarySchema,
  type: partnershipTypeSchema,
  status: partnershipStatusSchema,
  start: approximateDateSchema.nullable(),
  end: approximateDateSchema.nullable(),
  place: z.string().nullable(),
});
export type PartnerLink = z.infer<typeof partnerLinkSchema>;

/**
 * A derived sibling.
 *
 * `kind` is computed from how many parents are shared, and is deliberately
 * conservative: with only one parent recorded for either person, we say "half"
 * rather than claiming a full sibling we cannot evidence.
 */
export const siblingLinkSchema = z.object({
  member: memberSummarySchema,
  kind: z.enum(['FULL', 'HALF']),
  sharedParentIds: z.array(z.string().uuid()),
});
export type SiblingLink = z.infer<typeof siblingLinkSchema>;

export const memberRelationsSchema = z.object({
  memberId: z.string().uuid(),
  parents: z.array(parentLinkSchema),
  children: z.array(parentLinkSchema),
  partners: z.array(partnerLinkSchema),
  siblings: z.array(siblingLinkSchema),
});
export type MemberRelations = z.infer<typeof memberRelationsSchema>;

export const memberRelationsResponseSchema = z.object({ relations: memberRelationsSchema });
export type MemberRelationsResponse = z.infer<typeof memberRelationsResponseSchema>;

export const PARENT_RELATION_LABELS: Record<ParentRelationType, string> = {
  BIOLOGICAL: 'Biological',
  ADOPTIVE: 'Adoptive',
  STEP: 'Step',
  FOSTER: 'Foster',
  GUARDIAN: 'Guardian',
};

export const PARTNERSHIP_STATUS_LABELS: Record<PartnershipStatus, string> = {
  ACTIVE: 'Together',
  SEPARATED: 'Separated',
  DIVORCED: 'Divorced',
  ENDED_BY_DEATH: 'Ended by death',
};

export const PARTNERSHIP_TYPE_LABELS: Record<PartnershipType, string> = {
  MARRIAGE: 'Marriage',
  PARTNERSHIP: 'Partnership',
  UNION: 'Union',
};