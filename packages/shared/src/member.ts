import { z } from 'zod';
import { approximateDateSchema } from './dates.js';

/**
 * Member contracts.
 *
 * A Member is a person in a family tree. Distinct from a User, which is a
 * login: most members will never have an account, because they are deceased or
 * simply not users of the software.
 */

export const livingStatusSchema = z.enum(['LIVING', 'DECEASED', 'UNKNOWN']);
export type LivingStatus = z.infer<typeof livingStatusSchema>;

const nameField = z.string().trim().max(80);
const placeField = z.string().trim().max(160);

/**
 * The only requirement is a name - at least one of given or family.
 *
 * Everything else is optional, and that is a product decision as much as a
 * technical one: a form that demands a birth date will simply be given a made-up
 * one, and a schema that demands parents cannot record the ancestor whose
 * parents nobody remembers.
 */
export const createMemberInputSchema = z
  .object({
    givenName: nameField.optional(),
    familyName: nameField.optional(),
    otherNames: nameField.optional(),
    maidenName: nameField.optional(),
    /// Free text, not an enum. Historical records are inconsistent and this
    /// value carries no logic.
    gender: z.string().trim().max(40).optional(),

    livingStatus: livingStatusSchema.default('UNKNOWN'),

    birth: approximateDateSchema.optional(),
    birthPlace: placeField.optional(),
    death: approximateDateSchema.optional(),
    deathPlace: placeField.optional(),

    biography: z.string().trim().max(20000).optional(),
    occupation: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(5000).optional(),
  })
  .refine((value) => Boolean(value.givenName?.trim() || value.familyName?.trim()), {
    message: 'Enter at least a first or last name',
    path: ['givenName'],
  });
export type CreateMemberInput = z.infer<typeof createMemberInputSchema>;

export const updateMemberInputSchema = z
  .object({
    givenName: nameField.nullable(),
    familyName: nameField.nullable(),
    otherNames: nameField.nullable(),
    maidenName: nameField.nullable(),
    gender: z.string().trim().max(40).nullable(),
    birth: approximateDateSchema,
    birthPlace: placeField.nullable(),
    biography: z.string().trim().max(20000).nullable(),
    occupation: z.string().trim().max(120).nullable(),
    notes: z.string().trim().max(5000).nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });
export type UpdateMemberInput = z.infer<typeof updateMemberInputSchema>;

/**
 * Marking someone as deceased is its own operation, not a field on the update
 * form. It is a meaningful, audited state change that a family will remember
 * making, and it deserves its own confirmation rather than a dropdown.
 */
export const markDeceasedInputSchema = z.object({
  death: approximateDateSchema.optional(),
  deathPlace: placeField.nullable().optional(),
  /// Sensitive. Only visible to roles with sensitive:view.
  causeOfDeath: z.string().trim().max(200).nullable().optional(),
});
export type MarkDeceasedInput = z.infer<typeof markDeceasedInputSchema>;

/** Reverting a mistake, or recording that we simply do not know. */
export const setLivingStatusInputSchema = z.object({
  livingStatus: z.enum(['LIVING', 'UNKNOWN']),
});
export type SetLivingStatusInput = z.infer<typeof setLivingStatusInputSchema>;

export const memberSchema = z.object({
  id: z.string().uuid(),
  familyId: z.string().uuid(),

  givenName: z.string().nullable(),
  familyName: z.string().nullable(),
  otherNames: z.string().nullable(),
  displayName: z.string(),
  maidenName: z.string().nullable(),
  gender: z.string().nullable(),

  livingStatus: livingStatusSchema,

  birth: approximateDateSchema.nullable(),
  birthPlace: z.string().nullable(),
  death: approximateDateSchema.nullable(),
  deathPlace: z.string().nullable(),
  causeOfDeath: z.string().nullable(),

  biography: z.string().nullable(),
  occupation: z.string().nullable(),
  notes: z.string().nullable(),

  primaryPhotoId: z.string().uuid().nullable(),

  /**
   * True when details have been withheld because this is a living person and
   * the viewer's role does not permit seeing them. The UI says so plainly
   * rather than showing empty fields that look like missing data.
   */
  isRedacted: z.boolean(),
  /** True when the requesting user has claimed this member as themselves. */
  isYou: z.boolean(),

  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});
export type Member = z.infer<typeof memberSchema>;

/** The lighter shape used for lists and, later, tree nodes. */
export const memberSummarySchema = memberSchema.pick({
  id: true,
  displayName: true,
  givenName: true,
  familyName: true,
  maidenName: true,
  gender: true,
  livingStatus: true,
  birth: true,
  death: true,
  primaryPhotoId: true,
  isRedacted: true,
  isYou: true,
  deletedAt: true,
});
export type MemberSummary = z.infer<typeof memberSummarySchema>;

export const memberResponseSchema = z.object({ member: memberSchema });
export type MemberResponse = z.infer<typeof memberResponseSchema>;

export const memberListResponseSchema = z.object({
  members: z.array(memberSummarySchema),
  total: z.number().int().nonnegative(),
});
export type MemberListResponse = z.infer<typeof memberListResponseSchema>;