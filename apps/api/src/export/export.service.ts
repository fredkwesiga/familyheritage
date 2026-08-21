import { Injectable } from '@nestjs/common';
import { EXPORT_NOTICE, type FamilyExport } from '@fh/shared';
import { AuditService } from '../audit/audit.service';
import type { ActorContext } from '../families/families.service';
import type { FamilyContext } from '../families/family.types';
import { PhotosService } from '../photos/photos.service';
import { PrismaService } from '../prisma/prisma.service';

const toIso = (value: Date | null): string | null =>
  value ? value.toISOString().slice(0, 10) : null;

@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photos: PhotosService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Everything, in one object.
   *
   * Nothing is redacted here and that is deliberate: this is the family's own
   * archive, requested by its owner, and a backup with the difficult parts
   * removed is not a backup. The privacy rules that govern day-to-day reading
   * exist to protect living relatives from other members of the family - not to
   * withhold a family's records from the person responsible for them.
   */
  async build(context: FamilyContext, actor: ActorContext): Promise<FamilyExport> {
    const [family, members, parentChild, partnerships, stories, photos, exporter] =
      await Promise.all([
        this.prisma.family.findFirstOrThrow({ where: { id: context.familyId } }),
        this.prisma.scoped.member.findMany({
          where: { familyId: context.familyId, deletedAt: null },
          orderBy: [{ familyName: 'asc' }, { givenName: 'asc' }],
        }),
        this.prisma.scoped.parentChild.findMany({
          where: { familyId: context.familyId },
          select: { parentId: true, childId: true, relationType: true },
        }),
        this.prisma.scoped.partnership.findMany({ where: { familyId: context.familyId } }),
        this.prisma.scoped.story.findMany({
          where: { familyId: context.familyId, deletedAt: null },
          include: {
            author: { select: { name: true, email: true } },
            subjects: { select: { memberId: true } },
          },
          orderBy: { createdAt: 'asc' },
        }),
        this.photos.listForFamily(context),
        this.prisma.user.findUnique({
          where: { id: actor.userId },
          select: { name: true, email: true },
        }),
      ]);

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'FAMILY_EXPORTED',
      entityType: 'Family',
      entityId: context.familyId,
      summary: `Exported the whole family record (${members.length} people)`,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return {
      format: 'family-heritage-export',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      exportedBy: exporter?.name ?? exporter?.email ?? null,

      family: {
        id: family.id,
        name: family.name,
        description: family.description,
        createdAt: family.createdAt.toISOString(),
      },

      members: members.map((member) => ({
        id: member.id,
        givenName: member.givenName,
        familyName: member.familyName,
        otherNames: member.otherNames,
        maidenName: member.maidenName,
        displayName: member.displayName,
        gender: member.gender,
        livingStatus: member.livingStatus,
        birth: {
          date: toIso(member.birthDate),
          qualifier: member.birthDateQualifier,
          text: member.birthDateText,
        },
        birthPlace: member.birthPlace,
        death: {
          date: toIso(member.deathDate),
          qualifier: member.deathDateQualifier,
          text: member.deathDateText,
        },
        deathPlace: member.deathPlace,
        occupation: member.occupation,
        biography: member.biography,
        notes: member.notes,
      })),

      parentChild,

      partnerships: partnerships.map((partnership) => ({
        memberAId: partnership.memberAId,
        memberBId: partnership.memberBId,
        type: partnership.type,
        status: partnership.status,
        start: {
          date: toIso(partnership.startDate),
          qualifier: partnership.startDateQualifier,
          text: partnership.startDateText,
        },
        end: {
          date: toIso(partnership.endDate),
          qualifier: partnership.endDateQualifier,
          text: partnership.endDateText,
        },
        place: partnership.place,
      })),

      stories: stories.map((story) => ({
        id: story.id,
        title: story.title,
        body: story.body,
        // Provenance travels with the archive. A family reading this in twenty
        // years should still be able to tell what was written and what was
        // helped along.
        source: story.source,
        originalNotes: story.originalNotes,
        eventDate: {
          date: toIso(story.eventDate),
          qualifier: story.eventDateQualifier,
          text: story.eventDateText,
        },
        place: story.place,
        visibility: story.visibility,
        aboutMemberIds: story.subjects.map((subject: { memberId: string }) => subject.memberId),
        authorName: story.author?.name ?? story.author?.email ?? null,
        writtenAt: story.createdAt.toISOString(),
      })),

      photos: photos.map((photo) => ({
        id: photo.id,
        url: photo.url,
        caption: photo.caption,
        takenDate: photo.takenDate ?? { date: null, qualifier: null, text: null },
        takenPlace: photo.takenPlace,
        ofMemberIds: photo.subjectIds,
        addedAt: photo.uploadedAt,
      })),

      notice: EXPORT_NOTICE,
    };
  }

  /** A filename a person can find again in six months. */
  filenameFor(familyName: string, extension: 'json' | 'ged'): string {
    const slug = familyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
    const date = new Date().toISOString().slice(0, 10);
    return `${slug || 'family'}-${date}.${extension}`;
  }
}