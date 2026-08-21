import { z } from 'zod';
import { approximateDateSchema } from './dates.js';
import { livingStatusSchema } from './member.js';
import {
  parentRelationTypeSchema,
  partnershipStatusSchema,
  partnershipTypeSchema,
} from './relationship.js';

/**
 * The whole family, in a form nobody needs this software to read.
 *
 * This is the most important promise the product makes and the easiest one to
 * quietly break. A family is being asked to entrust several generations of
 * their history to a startup running on a free tier, and the honest answer to
 * "what happens if you disappear?" is a file they already have.
 *
 * Two formats, because they answer different questions. The JSON below is
 * complete - every field, every link, every story - and is what a developer
 * would use to rebuild this. GEDCOM is lossier but is what every other piece of
 * genealogy software on earth can open, which is what portability actually
 * means.
 */

export const exportedMemberSchema = z.object({
  id: z.string(),
  givenName: z.string().nullable(),
  familyName: z.string().nullable(),
  otherNames: z.string().nullable(),
  maidenName: z.string().nullable(),
  displayName: z.string(),
  gender: z.string().nullable(),
  livingStatus: livingStatusSchema,
  birth: approximateDateSchema,
  birthPlace: z.string().nullable(),
  death: approximateDateSchema,
  deathPlace: z.string().nullable(),
  occupation: z.string().nullable(),
  biography: z.string().nullable(),
  notes: z.string().nullable(),
});
export type ExportedMember = z.infer<typeof exportedMemberSchema>;

export const exportedParentChildSchema = z.object({
  parentId: z.string(),
  childId: z.string(),
  relationType: parentRelationTypeSchema,
});
export type ExportedParentChild = z.infer<typeof exportedParentChildSchema>;

export const exportedPartnershipSchema = z.object({
  memberAId: z.string(),
  memberBId: z.string(),
  type: partnershipTypeSchema,
  status: partnershipStatusSchema,
  start: approximateDateSchema,
  end: approximateDateSchema,
  place: z.string().nullable(),
});
export type ExportedPartnership = z.infer<typeof exportedPartnershipSchema>;

export const exportedStorySchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  /// Preserved so a family can always tell what was written and what was helped.
  source: z.string(),
  originalNotes: z.string().nullable(),
  eventDate: approximateDateSchema,
  place: z.string().nullable(),
  visibility: z.string(),
  aboutMemberIds: z.array(z.string()),
  authorName: z.string().nullable(),
  writtenAt: z.string(),
});
export type ExportedStory = z.infer<typeof exportedStorySchema>;

/**
 * Photographs are listed, not embedded.
 *
 * The files live with the storage provider, and a JSON document carrying a
 * hundred base64 images would be unusable. The URL is a signed one that works
 * for as long as the account does - which is stated plainly in the export so
 * nobody discovers the limitation years later.
 */
export const exportedPhotoSchema = z.object({
  id: z.string(),
  url: z.string(),
  caption: z.string().nullable(),
  takenDate: approximateDateSchema,
  takenPlace: z.string().nullable(),
  ofMemberIds: z.array(z.string()),
  addedAt: z.string(),
});
export type ExportedPhoto = z.infer<typeof exportedPhotoSchema>;

export const familyExportSchema = z.object({
  format: z.literal('family-heritage-export'),
  formatVersion: z.literal(1),
  exportedAt: z.string(),
  exportedBy: z.string().nullable(),

  family: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    createdAt: z.string(),
  }),

  members: z.array(exportedMemberSchema),
  parentChild: z.array(exportedParentChildSchema),
  partnerships: z.array(exportedPartnershipSchema),
  stories: z.array(exportedStorySchema),
  photos: z.array(exportedPhotoSchema),

  /// Said in the file itself, where it cannot be lost.
  notice: z.string(),
});
export type FamilyExport = z.infer<typeof familyExportSchema>;

export const EXPORT_NOTICE =
  'This file contains everything recorded about this family. Photographs are linked rather ' +
  'than embedded, and those links depend on the storage account remaining active - if this ' +
  'archive matters to you, download the images as well. The accompanying GEDCOM file can be ' +
  'opened by most genealogy software.';