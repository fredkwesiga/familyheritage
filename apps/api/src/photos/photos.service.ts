import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ErrorCode,
  normalizeDate,
  type ConfirmPhotoInput,
  type Photo,
  type UpdatePhotoInput,
  type UploadTarget,
} from '@fh/shared';
import { AuditService } from '../audit/audit.service';
import type { ActorContext } from '../families/families.service';
import type { FamilyContext } from '../families/family.types';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER, type StorageProvider } from './storage.provider';

interface PhotoRow {
  id: string;
  familyId: string;
  storageId: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  takenDate: Date | null;
  takenDateQualifier: 'EXACT' | 'ABOUT' | 'BEFORE' | 'AFTER' | 'RANGE' | null;
  takenDateText: string | null;
  takenPlace: string | null;
  createdAt: Date;
  subjects?: Array<{ memberId: string }>;
}

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  // ------------------------------------------------------------------ upload

  createUploadTarget(context: FamilyContext): UploadTarget {
    this.assertStorageAvailable();
    return this.storage.createSignedUpload(context.familyId);
  }

  /**
   * Records an upload the browser says it completed.
   *
   * Everything the client reports about the file is discarded. We ask the
   * storage provider what is actually there, and we check the asset landed
   * inside this family's folder - otherwise one family could claim another's
   * photograph simply by naming its id.
   */
  async confirm(
    context: FamilyContext,
    input: ConfirmPhotoInput,
    actor: ActorContext,
  ): Promise<Photo> {
    this.assertStorageAvailable();

    if (!input.storageId.startsWith(`families/${context.familyId}/`)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'That upload does not belong to this family.',
      });
    }

    const asset = await this.storage.describe(input.storageId);
    if (!asset) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'That upload could not be found. Try again.',
      });
    }

    await this.assertMembersBelong(context, input.memberIds);

    // The date the family typed wins; the camera's date is the fallback. A
    // person's memory of when a photograph was taken is often better evidence
    // than a clock that may never have been set.
    const takenDate = normalizeDate(input.takenDate);
    const useCameraDate = !takenDate.date && !takenDate.text && asset.capturedAt;

    const photo = (await this.prisma.scoped.photo.create({
      data: {
        familyId: context.familyId,
        storageProvider: 'cloudinary',
        storageId: asset.storageId,
        deliveryType: 'authenticated',
        width: asset.width,
        height: asset.height,
        bytes: asset.bytes,
        format: asset.format,
        caption: input.caption ?? null,
        takenDate: useCameraDate ? asset.capturedAt : takenDate.date ? new Date(`${takenDate.date}T00:00:00.000Z`) : null,
        takenDateQualifier: useCameraDate ? 'EXACT' : takenDate.qualifier,
        takenDateText: useCameraDate ? null : takenDate.text,
        takenPlace: input.takenPlace ?? null,
        uploadedById: actor.userId,
        subjects: {
          create: input.memberIds.map((memberId) => ({
            memberId,
            familyId: context.familyId,
          })),
        },
      },
      include: { subjects: { select: { memberId: true } } },
    })) as PhotoRow;

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'PHOTO_UPLOADED',
      entityType: 'Photo',
      entityId: photo.id,
      summary: input.caption ? `Added a photograph: ${input.caption}` : 'Added a photograph',
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return this.toPhoto(photo);
  }

  // -------------------------------------------------------------------- read

  async listForFamily(context: FamilyContext): Promise<Photo[]> {
    const rows = (await this.prisma.scoped.photo.findMany({
      where: { familyId: context.familyId, deletedAt: null },
      include: { subjects: { select: { memberId: true } } },
      orderBy: { createdAt: 'desc' },
    })) as PhotoRow[];

    return rows.map((row) => this.toPhoto(row));
  }

  async listForMember(context: FamilyContext, memberId: string): Promise<Photo[]> {
    const rows = (await this.prisma.scoped.photo.findMany({
      where: {
        familyId: context.familyId,
        deletedAt: null,
        subjects: { some: { memberId } },
      },
      include: { subjects: { select: { memberId: true } } },
      orderBy: { createdAt: 'desc' },
    })) as PhotoRow[];

    return rows.map((row) => this.toPhoto(row));
  }

    /**
   * A signed thumbnail URL for every member who has a profile picture.
   *
   * One query and one signing pass for the whole family, which is what lets the
   * member list, the relations panel and the tree all show faces without any of
   * them knowing anything about photo storage.
   */
  async memberAvatars(context: FamilyContext): Promise<Record<string, string>> {
    if (!this.storage.isConfigured) return {};

    const members = (await this.prisma.scoped.member.findMany({
      where: { familyId: context.familyId, deletedAt: null, primaryPhotoId: { not: null } },
      select: { id: true, primaryPhotoId: true },
    })) as Array<{ id: string; primaryPhotoId: string }>;

    if (members.length === 0) return {};

    const photos = (await this.prisma.scoped.photo.findMany({
      where: {
        familyId: context.familyId,
        deletedAt: null,
        id: { in: members.map((member) => member.primaryPhotoId) },
      },
      select: { id: true, storageId: true },
    })) as Array<{ id: string; storageId: string }>;

    const storageById = new Map(photos.map((photo) => [photo.id, photo.storageId]));

    const avatars: Record<string, string> = {};
    for (const member of members) {
      const storageId = storageById.get(member.primaryPhotoId);
      // A photograph deleted since the member pointed at it simply has no
      // entry, and the avatar falls back to a monogram.
      if (storageId) avatars[member.id] = this.storage.signedUrl(storageId, 'thumb');
    }
    return avatars;
  }

  // ------------------------------------------------------------------ update

  async update(
    context: FamilyContext,
    photoId: string,
    input: UpdatePhotoInput,
    actor: ActorContext,
  ): Promise<Photo> {
    await this.requirePhoto(context, photoId);

    if (input.memberIds) {
      await this.assertMembersBelong(context, input.memberIds);
      // Replace the whole set rather than diffing: tagging is a small list and
      // "who is in this photograph" is answered wholesale, not incrementally.
      await this.prisma.scoped.photoSubject.deleteMany({
        where: { familyId: context.familyId, photoId },
      });
      if (input.memberIds.length > 0) {
        await this.prisma.scoped.photoSubject.createMany({
          data: input.memberIds.map((memberId) => ({
            photoId,
            memberId,
            familyId: context.familyId,
          })),
        });
      }
    }

    const takenDate = input.takenDate ? normalizeDate(input.takenDate) : undefined;

    const row = (await this.prisma.scoped.photo.update({
      where: { id: photoId, familyId: context.familyId },
      data: {
        ...(input.caption !== undefined ? { caption: input.caption } : {}),
        ...(input.takenPlace !== undefined ? { takenPlace: input.takenPlace } : {}),
        ...(takenDate
          ? {
              takenDate: takenDate.date ? new Date(`${takenDate.date}T00:00:00.000Z`) : null,
              takenDateQualifier: takenDate.qualifier,
              takenDateText: takenDate.text,
            }
          : {}),
      },
      include: { subjects: { select: { memberId: true } } },
    })) as PhotoRow;

    return this.toPhoto(row);
  }

  /**
   * Makes a photograph the one shown on a member's card and profile.
   *
   * The photograph itself is never altered - not when this is set, and not when
   * someone is marked as having died. Only how it is displayed changes.
   */
  async setPrimary(
    context: FamilyContext,
    memberId: string,
    photoId: string | null,
    actor: ActorContext,
  ): Promise<void> {
    if (photoId) {
      const photo = await this.requirePhoto(context, photoId);
      const isSubject = (photo.subjects ?? []).some((subject) => subject.memberId === memberId);
      if (!isSubject) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Tag that person in the photograph before making it their picture.',
        });
      }
    }

    await this.prisma.scoped.member.update({
      where: { id: memberId, familyId: context.familyId },
      data: { primaryPhotoId: photoId, updatedById: actor.userId },
    });

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'PRIMARY_PHOTO_SET',
      entityType: 'Member',
      entityId: memberId,
      summary: photoId ? 'Set a profile photograph' : 'Removed the profile photograph',
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  }

  /**
   * Soft delete.
   *
   * The bytes stay with the storage provider. A family photograph removed by
   * one relative on a Tuesday is exactly the kind of thing another relative
   * asks about on Friday, and "it is gone forever" is a bad answer.
   */
  async remove(context: FamilyContext, photoId: string, actor: ActorContext): Promise<void> {
    await this.requirePhoto(context, photoId);

    await this.prisma.$transaction([
      this.prisma.scoped.photo.updateMany({
        where: { id: photoId, familyId: context.familyId },
        data: { deletedAt: new Date() },
      }),
      // A dangling primaryPhotoId would render as a broken image on a profile.
      this.prisma.scoped.member.updateMany({
        where: { familyId: context.familyId, primaryPhotoId: photoId },
        data: { primaryPhotoId: null },
      }),
    ]);

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'PHOTO_DELETED',
      entityType: 'Photo',
      entityId: photoId,
      summary: 'Removed a photograph',
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  }

  // ----------------------------------------------------------------- helpers

  /** Signed URLs are generated per response, after membership has been checked. */
  private toPhoto(row: PhotoRow): Photo {
    return {
      id: row.id,
      url: this.storage.signedUrl(row.storageId, 'full'),
      thumbnailUrl: this.storage.signedUrl(row.storageId, 'thumb'),
      width: row.width,
      height: row.height,
      caption: row.caption,
      takenDate: {
        date: row.takenDate ? row.takenDate.toISOString().slice(0, 10) : null,
        qualifier: row.takenDateQualifier,
        text: row.takenDateText,
      },
      takenPlace: row.takenPlace,
      subjectIds: (row.subjects ?? []).map((subject) => subject.memberId),
      uploadedAt: row.createdAt.toISOString(),
    };
  }

  private async requirePhoto(context: FamilyContext, photoId: string): Promise<PhotoRow> {
    const row = (await this.prisma.scoped.photo.findFirst({
      where: { id: photoId, familyId: context.familyId, deletedAt: null },
      include: { subjects: { select: { memberId: true } } },
    })) as PhotoRow | null;

    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'That photograph is not in this family.',
      });
    }
    return row;
  }

  /** Tagging is cross-family reachable unless every id is checked. */
  private async assertMembersBelong(context: FamilyContext, memberIds: string[]): Promise<void> {
    if (memberIds.length === 0) return;

    const found = await this.prisma.scoped.member.count({
      where: { familyId: context.familyId, id: { in: memberIds }, deletedAt: null },
    });

    if (found !== new Set(memberIds).size) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'One of those people is not in this family tree.',
      });
    }
  }

  private assertStorageAvailable(): void {
    if (!this.storage.isConfigured) {
      throw new ServiceUnavailableException({
        code: ErrorCode.INTERNAL,
        message: 'Photograph storage is not set up yet.',
      });
    }
  }
}