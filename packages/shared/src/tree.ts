import { z } from 'zod';
import { memberSummarySchema } from './member.js';
import {
  parentRelationTypeSchema,
  partnershipStatusSchema,
  partnershipTypeSchema,
} from './relationship.js';

/**
 * The whole family graph in one response.
 *
 * A family is ten to a hundred people, so fetching everything at once is both
 * simpler and faster than paging: one request, and the client can then compute
 * generations, siblings and relationships locally using the same engine the
 * server uses. No round trip to re-centre the tree on someone else.
 *
 * If a family ever reaches thousands of members this becomes a windowed query
 * around a focus point. Nothing in the client would need to change shape.
 */
export const treeEdgeSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid(),
  childId: z.string().uuid(),
  relationType: parentRelationTypeSchema,
});
export type TreeEdge = z.infer<typeof treeEdgeSchema>;

export const treePartnershipSchema = z.object({
  id: z.string().uuid(),
  memberAId: z.string().uuid(),
  memberBId: z.string().uuid(),
  type: partnershipTypeSchema,
  status: partnershipStatusSchema,
});
export type TreePartnership = z.infer<typeof treePartnershipSchema>;

export const familyTreeSchema = z.object({
  members: z.array(memberSummarySchema),
  parentChild: z.array(treeEdgeSchema),
  partnerships: z.array(treePartnershipSchema),
  /** Where to start when nobody has been chosen: your own record, or the family default. */
  suggestedRootId: z.string().uuid().nullable(),
});
export type FamilyTree = z.infer<typeof familyTreeSchema>;

export const familyTreeResponseSchema = z.object({ tree: familyTreeSchema });
export type FamilyTreeResponse = z.infer<typeof familyTreeResponseSchema>;