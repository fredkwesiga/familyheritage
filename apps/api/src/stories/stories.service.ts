import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ErrorCode,
  normalizeDate,
  Permission,
  roleHasPermission,
  type CreateStoryInput,
  type Story,
  type UpdateStoryInput,
} from '@fh/shared';
import { AuditService } from '../audit/audit.service';
import type { ActorContext } from '../families/families.service';
import type { FamilyContext } from '../families/family.types';
import { toMemberSummary, type MemberRow } from '../members/member.mapper';
import { PrismaService } from '../prisma/prisma.service';

interface StoryRow {
  id: string;
  familyId: string;
  title: string;
  body: string;
  source: 'HUMAN' | 'AI_ASSISTED_DRAFT' | 'AI_ASSISTED_APPROVED';
  originalNotes: string | null;
  eventDate: Date | null;
  eventDateQualifier: 'EXACT' | 'ABOUT' | 'BEFORE' | 'AFTER' | 'RANGE' | null;
  eventDateText: string | null;
  place: string | null;
  visibility: 'FAMILY' | 'ADMINS_ONLY';
  authorUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  author?: { name: string | null; email: string } | null;
  subjects?: Array<{ member: MemberRow }>;
}

@Injectable()
export class StoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ create

  async create(
    context: FamilyContext,
    input: CreateStoryInput,
    actor: ActorContext,
  ): Promise<Story> {
    await this.assertMembersBelong(context, input.memberIds);
    this.assertMayUseVisibility(context, input.visibility);

    const eventDate = normalizeDate(input.eventDate);

    const row = (await this.prisma.scoped.story.create({
      data: {
        familyId: context.familyId,
        title: input.title,
        body: input.body,
        source: 'HUMAN',
        eventDate: eventDate.date ? new Date(`${eventDate.date}T00:00:00.000Z`) : null,
        eventDateQualifier: eventDate.qualifier,
        eventDateText: eventDate.text,
        place: input.place ?? null,
        visibility: input.visibility,
        authorUserId: actor.userId,
        subjects: {
          create: input.memberIds.map((memberId) => ({
            memberId,
            familyId: context.familyId,
          })),
        },
      },
      include: this.include(),
    })) as StoryRow;

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'STORY_CREATED',
      entityType: 'Story',
      entityId: row.id,
      summary: `Wrote "${row.title}"`,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return this.toStory(row, context, actor.userId, await this.hideLiving(context));
  }

  // -------------------------------------------------------------------- read

  async list(context: FamilyContext, userId: string): Promise<Story[]> {
    const rows = (await this.prisma.scoped.story.findMany({
      where: {
        familyId: context.familyId,
        deletedAt: null,
        ...this.visibilityFilter(context, userId),
      },
      include: this.include(),
      orderBy: { createdAt: 'desc' },
    })) as StoryRow[];

    const hideLiving = await this.hideLiving(context);
    return rows.map((row) => this.toStory(row, context, userId, hideLiving));
  }

  async listForMember(
    context: FamilyContext,
    memberId: string,
    userId: string,
  ): Promise<Story[]> {
    const rows = (await this.prisma.scoped.story.findMany({
      where: {
        familyId: context.familyId,
        deletedAt: null,
        subjects: { some: { memberId } },
        ...this.visibilityFilter(context, userId),
      },
      include: this.include(),
      orderBy: { createdAt: 'desc' },
    })) as StoryRow[];

    const hideLiving = await this.hideLiving(context);
    return rows.map((row) => this.toStory(row, context, userId, hideLiving));
  }

  async getOne(context: FamilyContext, storyId: string, userId: string): Promise<Story> {
    const row = await this.requireStory(context, storyId, userId);
    return this.toStory(row, context, userId, await this.hideLiving(context));
  }

  // ------------------------------------------------------------------ update

  async update(
    context: FamilyContext,
    storyId: string,
    input: UpdateStoryInput,
    actor: ActorContext,
  ): Promise<Story> {
    const before = await this.requireStory(context, storyId, actor.userId);
    this.assertCanEdit(context, before, actor.userId);

    if (input.visibility) this.assertMayUseVisibility(context, input.visibility);

    if (input.memberIds) {
      await this.assertMembersBelong(context, input.memberIds);
      await this.prisma.scoped.storySubject.deleteMany({
        where: { familyId: context.familyId, storyId },
      });
      if (input.memberIds.length > 0) {
        await this.prisma.scoped.storySubject.createMany({
          data: input.memberIds.map((memberId) => ({
            storyId,
            memberId,
            familyId: context.familyId,
          })),
        });
      }
    }

    const eventDate = input.eventDate ? normalizeDate(input.eventDate) : undefined;

    const row = (await this.prisma.scoped.story.update({
      where: { id: storyId, familyId: context.familyId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.place !== undefined ? { place: input.place } : {}),
        ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
        ...(eventDate
          ? {
              eventDate: eventDate.date ? new Date(`${eventDate.date}T00:00:00.000Z`) : null,
              eventDateQualifier: eventDate.qualifier,
              eventDateText: eventDate.text,
            }
          : {}),
      },
      include: this.include(),
    })) as StoryRow;

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'STORY_UPDATED',
      entityType: 'Story',
      entityId: storyId,
      summary: `Edited "${row.title}"`,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return this.toStory(row, context, actor.userId, await this.hideLiving(context));
  }

  /**
   * Publishes an AI-assisted draft.
   *
   * Defined now, before any AI exists, because it is the mechanism that makes
   * "AI must never publish automatically" true rather than aspirational. A
   * draft is invisible to the rest of the family until a person - the person
   * who asked for it - reads it and says yes.
   */
  async approveDraft(
    context: FamilyContext,
    storyId: string,
    actor: ActorContext,
  ): Promise<Story> {
    const before = await this.requireStory(context, storyId, actor.userId);

    if (before.source !== 'AI_ASSISTED_DRAFT') {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'That story is not a draft.',
      });
    }
    if (before.authorUserId !== actor.userId) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Only the person who asked for this draft can publish it.',
      });
    }

    const row = (await this.prisma.scoped.story.update({
      where: { id: storyId, familyId: context.familyId },
      data: { source: 'AI_ASSISTED_APPROVED' },
      include: this.include(),
    })) as StoryRow;

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'STORY_UPDATED',
      entityType: 'Story',
      entityId: storyId,
      summary: `Published the assisted draft "${row.title}"`,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return this.toStory(row, context, actor.userId, await this.hideLiving(context));
  }

  async remove(context: FamilyContext, storyId: string, actor: ActorContext): Promise<void> {
    const story = await this.requireStory(context, storyId, actor.userId);

    const isAuthor = story.authorUserId === actor.userId;
    if (!isAuthor && !roleHasPermission(context.role, Permission.STORY_DELETE)) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Only an admin, or the person who wrote it, can remove a story.',
      });
    }

    await this.prisma.scoped.story.updateMany({
      where: { id: storyId, familyId: context.familyId },
      data: { deletedAt: new Date() },
    });

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'STORY_DELETED',
      entityType: 'Story',
      entityId: storyId,
      summary: `Removed "${story.title}"`,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  }

  // ----------------------------------------------------------------- helpers

  private include() {
    return {
      author: { select: { name: true, email: true } },
      subjects: { include: { member: true } },
    };
  }

  /**
   * Two rules, applied in the query rather than after it.
   *
   * Filtering in the mapper would mean the rows still crossed the wire from the
   * database, and one forgotten check away from crossing it to the browser.
   */
  private visibilityFilter(context: FamilyContext, userId: string) {
    const conditions: Array<Record<string, unknown>> = [];

    // Sensitive stories - adoption, estrangement, illness - are for admins.
    if (!roleHasPermission(context.role, Permission.SENSITIVE_VIEW)) {
      conditions.push({ visibility: 'FAMILY' });
    }

    // An unapproved AI draft belongs to nobody but the person who asked for it.
    conditions.push({
      OR: [{ source: { not: 'AI_ASSISTED_DRAFT' } }, { authorUserId: userId }],
    });

    return conditions.length > 0 ? { AND: conditions } : {};
  }

  /** The author may always edit their own story, whatever their role. */
  private canEdit(context: FamilyContext, story: StoryRow, userId: string): boolean {
    if (story.authorUserId === userId) return true;
    return roleHasPermission(context.role, Permission.STORY_UPDATE);
  }

  private assertCanEdit(context: FamilyContext, story: StoryRow, userId: string): void {
    if (this.canEdit(context, story, userId)) return;
    throw new ForbiddenException({
      code: ErrorCode.FORBIDDEN,
      message: 'Only an admin, or the person who wrote it, can edit a story.',
    });
  }

  private assertMayUseVisibility(context: FamilyContext, visibility: string): void {
    if (visibility !== 'ADMINS_ONLY') return;
    if (roleHasPermission(context.role, Permission.SENSITIVE_VIEW)) return;

    throw new ForbiddenException({
      code: ErrorCode.FORBIDDEN,
      message: 'Your role cannot mark a story as admin-only.',
    });
  }

  private toStory(
    row: StoryRow,
    context: FamilyContext,
    userId: string,
    hideLiving: boolean,
  ): Story {
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      source: row.source,
      originalNotes: row.originalNotes,
      eventDate: {
        date: row.eventDate ? row.eventDate.toISOString().slice(0, 10) : null,
        qualifier: row.eventDateQualifier,
        text: row.eventDateText,
      },
      place: row.place,
      visibility: row.visibility,
      subjects: (row.subjects ?? [])
        .filter((subject) => subject.member.deletedAt === null)
        .map((subject) => toMemberSummary(subject.member, context, hideLiving)),
      authorName: row.author?.name ?? row.author?.email ?? null,
      canEdit: this.canEdit(context, row, userId),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async requireStory(
    context: FamilyContext,
    storyId: string,
    userId: string,
  ): Promise<StoryRow> {
    const row = (await this.prisma.scoped.story.findFirst({
      where: {
        id: storyId,
        familyId: context.familyId,
        deletedAt: null,
        ...this.visibilityFilter(context, userId),
      },
      include: this.include(),
    })) as StoryRow | null;

    if (!row) {
      // 404 rather than 403: a story someone may not read should not be
      // confirmed to exist.
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'That story is not in this family.',
      });
    }
    return row;
  }

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

  private async hideLiving(context: FamilyContext): Promise<boolean> {
    const family = await this.prisma.family.findFirst({
      where: { id: context.familyId },
      select: { hideLivingFromViewers: true },
    });
    return family?.hideLivingFromViewers ?? true;
  }
}