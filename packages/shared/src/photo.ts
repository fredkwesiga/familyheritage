import { z } from 'zod';
import { approximateDateSchema } from './dates.js';

/**
 * Photograph contracts.
 *
 * Bytes never pass through our API. The browser uploads straight to the storage
 * provider using a signature we issue after checking permission, then tells us
 * what was created. On a 512 MB free-tier instance, streaming family photo
 * albums through the API would be the first thing to fall over.
 */

export const uploadTargetSchema = z.object({
  /** Where the browser POSTs the file. */
  uploadUrl: z.string().url(),
  /** Signed parameters. Sent alongside the file, unmodified. */
  params: z.record(z.string()),
  /** The id the asset will have once stored - echoed back on confirm. */
  storageId: z.string(),
});
export type UploadTarget = z.infer<typeof uploadTargetSchema>;

/**
 * What the browser tells us after a successful upload.
 *
 * Every field is verified against the provider before a row is written, because
 * this arrives from the client and a client can say anything.
 */
export const confirmPhotoInputSchema = z.object({
  storageId: z.string().min(1).max(300),
  caption: z.string().trim().max(300).optional(),
  takenDate: approximateDateSchema.optional(),
  takenPlace: z.string().trim().max(160).optional(),
  /// A wedding photograph belongs to six people, not one.
  memberIds: z.array(z.string().uuid()).max(50).default([]),
});
export type ConfirmPhotoInput = z.infer<typeof confirmPhotoInputSchema>;

export const updatePhotoInputSchema = z
  .object({
    caption: z.string().trim().max(300).nullable(),
    takenDate: approximateDateSchema,
    takenPlace: z.string().trim().max(160).nullable(),
    memberIds: z.array(z.string().uuid()).max(50),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });
export type UpdatePhotoInput = z.infer<typeof updatePhotoInputSchema>;

export const photoSchema = z.object({
  id: z.string().uuid(),
  /**
   * A signed delivery URL.
   *
   * Generated per request, after membership has been checked. The asset is
   * stored as "authenticated", so this URL cannot be produced by guessing - and
   * a family photograph is never reachable simply by knowing its address.
   */
  url: z.string(),
  /** A small, cheap version for grids and avatars. */
  thumbnailUrl: z.string(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  caption: z.string().nullable(),
  takenDate: approximateDateSchema.nullable(),
  takenPlace: z.string().nullable(),
  /// Everyone who appears in this photograph.
  subjectIds: z.array(z.string().uuid()),
  uploadedAt: z.string(),
});
export type Photo = z.infer<typeof photoSchema>;

export const photoResponseSchema = z.object({ photo: photoSchema });
export type PhotoResponse = z.infer<typeof photoResponseSchema>;

export const photoListResponseSchema = z.object({ photos: z.array(photoSchema) });
export type PhotoListResponse = z.infer<typeof photoListResponseSchema>;

export const uploadTargetResponseSchema = z.object({ target: uploadTargetSchema });
export type UploadTargetResponse = z.infer<typeof uploadTargetResponseSchema>;

/** 8 MB. Larger than any phone photograph, small enough to protect the quota. */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

/**
 * Every member's profile picture, in one lookup.
 *
 * A separate endpoint rather than a field on Member, deliberately. Signing a
 * delivery URL is cheap but not free, and members are returned by four
 * different endpoints - the list, the profile, the relations panel and the
 * tree. Rather than thread photo resolution through all of them, the client
 * fetches this map once and every avatar reads from it.
 */
export const memberAvatarsResponseSchema = z.object({
  /** memberId -> signed thumbnail URL. Members without a picture are absent. */
  avatars: z.record(z.string()),
});
export type MemberAvatarsResponse = z.infer<typeof memberAvatarsResponseSchema>;