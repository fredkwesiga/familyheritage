import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ErrorCode,
  Permission,
  roleHasPermission,
  type ApproximateDate,
  type CreateMemberInput,
  type MarkDeceasedInput,
  type Member,
  type MemberSummary,
  type SetLivingStatusInput,
  type UpdateMemberInput,
  type MemberSearchResult,
} from '@fh/shared';
import { AuditService } from '../audit/audit.service';
import type { ActorContext } from '../families/families.service';
import type { FamilyContext } from '../families/family.types';
import { PrismaService } from '../prisma/prisma.service';
import { deriveDisplayName, toMember, toMemberSummary, type MemberRow } from './member.mapper';
import { MemberSearchRepository } from './member-search.repository';

/** Splits an ApproximateDate into the three columns it is stored as. */
function dateColumns(prefix: 'birth' | 'death', value: ApproximateDate | null | undefined) {
  if (value === undefined) return {};
  return {
    [`${prefix}Date`]: value?.date ? new Date(`${value.date}T00:00:00.000Z`) : null,
    [`${prefix}DateQualifier`]: value?.qualifier ?? null,
    [`${prefix}DateText`]: value?.text ?? null,
  };
}

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly searchRepository: MemberSearchRepository,
  ) { }

  /**
   * Fuzzy search across names.
   *
   * Results pass through the same mapper as every other read, so a living
   * relative's details stay hidden from a viewer who should not see them.
   * Search is a common way for a privacy rule to be quietly bypassed - the
   * filtering happens somewhere else, and the search path forgets.
   */
  async search(
    context: FamilyContext,
    query: string,
    limit: number,
  ): Promise<MemberSearchResult[]> {
    const hits = await this.searchRepository.search(context.familyId, query, limit);
    const hideLiving = await this.hideLiving(context);

    return hits.map((hit) => ({
      member: toMemberSummary(hit, context, hideLiving),
      matchedOn: hit.matchedOn,
      score: Number(hit.score),
    }));
  }


  // ------------------------------------------------------------------ create

  async create(
    context: FamilyContext,
    input: CreateMemberInput,
    actor: ActorContext,
  ): Promise<Member> {
    const displayName = deriveDisplayName(input);

    const row = (await this.prisma.scoped.member.create({
      data: {
        familyId: context.familyId,
        givenName: input.givenName ?? null,
        familyName: input.familyName ?? null,
        otherNames: input.otherNames ?? null,
        maidenName: input.maidenName ?? null,
        displayName,
        gender: input.gender ?? null,
        livingStatus: input.livingStatus,
        ...dateColumns('birth', input.birth),
        birthPlace: input.birthPlace ?? null,
        ...dateColumns('death', input.death),
        deathPlace: input.deathPlace ?? null,
        biography: input.biography ?? null,
        occupation: input.occupation ?? null,
        notes: input.notes ?? null,
        createdById: actor.userId,
        updatedById: actor.userId,
      },
    })) as MemberRow;

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'MEMBER_CREATED',
      entityType: 'Member',
      entityId: row.id,
      summary: `Added ${displayName}`,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return toMember(row, context, await this.hideLiving(context));
  }

  // -------------------------------------------------------------------- read

  async list(
    context: FamilyContext,
    options: { includeDeleted?: boolean } = {},
  ): Promise<{ members: MemberSummary[]; total: number }> {
    const includeDeleted =
      options.includeDeleted === true && roleHasPermission(context.role, Permission.MEMBER_DELETE);

    const rows = (await this.prisma.scoped.member.findMany({
      where: {
        familyId: context.familyId,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      orderBy: [{ familyName: 'asc' }, { givenName: 'asc' }, { displayName: 'asc' }],
    })) as MemberRow[];

    const hideLiving = await this.hideLiving(context);
    return {
      members: rows.map((row) => toMemberSummary(row, context, hideLiving)),
      total: rows.length,
    };
  }

  async getOne(context: FamilyContext, memberId: string): Promise<Member> {
    const row = await this.requireMember(context, memberId);
    return toMember(row, context, await this.hideLiving(context));
  }

  // ------------------------------------------------------------------ update

  async update(
    context: FamilyContext,
    memberId: string,
    input: UpdateMemberInput,
    actor: ActorContext,
  ): Promise<Member> {
    const before = await this.requireMember(context, memberId);
    this.assertCanEdit(context, memberId);

    const nextGiven = input.givenName === undefined ? before.givenName : input.givenName;
    const nextFamily = input.familyName === undefined ? before.familyName : input.familyName;

    const row = (await this.prisma.scoped.member.update({
      where: { id: memberId, familyId: context.familyId },
      data: {
        ...(input.givenName !== undefined ? { givenName: input.givenName } : {}),
        ...(input.familyName !== undefined ? { familyName: input.familyName } : {}),
        ...(input.otherNames !== undefined ? { otherNames: input.otherNames } : {}),
        ...(input.maidenName !== undefined ? { maidenName: input.maidenName } : {}),
        ...(input.gender !== undefined ? { gender: input.gender } : {}),
        ...(input.birthPlace !== undefined ? { birthPlace: input.birthPlace } : {}),
        ...(input.biography !== undefined ? { biography: input.biography } : {}),
        ...(input.occupation !== undefined ? { occupation: input.occupation } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...dateColumns('birth', input.birth),
        // Recomputed on every write, so it can never drift from the parts.
        displayName: deriveDisplayName({ givenName: nextGiven, familyName: nextFamily }),
        updatedById: actor.userId,
      },
    })) as MemberRow;

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'MEMBER_UPDATED',
      entityType: 'Member',
      entityId: memberId,
      summary: `Edited ${row.displayName}`,
      diff: AuditService.diffOf(
        {
          givenName: before.givenName,
          familyName: before.familyName,
          gender: before.gender,
          birthPlace: before.birthPlace,
          occupation: before.occupation,
        },
        {
          givenName: input.givenName,
          familyName: input.familyName,
          gender: input.gender,
          birthPlace: input.birthPlace,
          occupation: input.occupation,
        },
      ),
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return toMember(row, context, await this.hideLiving(context));
  }

  // ---------------------------------------------------------- living status

  /**
   * Marks someone as deceased.
   *
   * A date is not required. You will constantly know that a relative died
   * without knowing when, and refusing to record the death until someone
   * produces a date would make the tree quietly wrong.
   */
  async markDeceased(
    context: FamilyContext,
    memberId: string,
    input: MarkDeceasedInput,
    actor: ActorContext,
  ): Promise<Member> {
    const before = await this.requireMember(context, memberId);
    this.assertCanEdit(context, memberId);

    if (before.livingStatus === 'DECEASED') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: `${before.displayName} is already recorded as having passed away.`,
      });
    }

    const row = (await this.prisma.scoped.member.update({
      where: { id: memberId, familyId: context.familyId },
      data: {
        livingStatus: 'DECEASED',
        ...dateColumns('death', input.death ?? { date: null, qualifier: null, text: null }),
        deathPlace: input.deathPlace ?? null,
        causeOfDeath: input.causeOfDeath ?? null,
        updatedById: actor.userId,
      },
    })) as MemberRow;

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'MEMBER_MARKED_DECEASED',
      entityType: 'Member',
      entityId: memberId,
      summary: `Recorded that ${row.displayName} has passed away`,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return toMember(row, context, await this.hideLiving(context));
  }

  /** Reverses a mistake. Audited distinctly, because it is a notable correction. */
  async setLivingStatus(
    context: FamilyContext,
    memberId: string,
    input: SetLivingStatusInput,
    actor: ActorContext,
  ): Promise<Member> {
    const before = await this.requireMember(context, memberId);
    this.assertCanEdit(context, memberId);

    const row = (await this.prisma.scoped.member.update({
      where: { id: memberId, familyId: context.familyId },
      data: {
        livingStatus: input.livingStatus,
        // The death details are cleared, but the original photograph and every
        // other record are untouched.
        deathDate: null,
        deathDateQualifier: null,
        deathDateText: null,
        deathPlace: null,
        causeOfDeath: null,
        updatedById: actor.userId,
      },
    })) as MemberRow;

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'MEMBER_DEATH_REVERTED',
      entityType: 'Member',
      entityId: memberId,
      summary: `Changed ${row.displayName} from ${before.livingStatus} to ${input.livingStatus}`,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return toMember(row, context, await this.hideLiving(context));
  }

  // ------------------------------------------------------------------ delete

  /**
   * Soft delete, always.
   *
   * Nobody should be able to permanently erase a great-grandmother by
   * misreading a confirmation dialog. The row stays and an admin can restore it.
   */
  async softDelete(context: FamilyContext, memberId: string, actor: ActorContext): Promise<void> {
    const row = await this.requireMember(context, memberId);

    await this.prisma.scoped.member.update({
      where: { id: memberId, familyId: context.familyId },
      data: { deletedAt: new Date(), updatedById: actor.userId },
    });

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'MEMBER_DELETED',
      entityType: 'Member',
      entityId: memberId,
      summary: `Removed ${row.displayName} from the tree`,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  }

  async restore(context: FamilyContext, memberId: string, actor: ActorContext): Promise<Member> {
    const row = (await this.prisma.scoped.member.update({
      where: { id: memberId, familyId: context.familyId },
      data: { deletedAt: null, updatedById: actor.userId },
    })) as MemberRow;

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'MEMBER_RESTORED',
      entityType: 'Member',
      entityId: memberId,
      summary: `Restored ${row.displayName}`,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return toMember(row, context, await this.hideLiving(context));
  }

  // ------------------------------------------------------------------- claim

  /**
   * Links the signed-in user to their own record in the tree.
   *
   * This is what grants the self-edit right, and later what makes "how am I
   * related to David?" answerable at all.
   */
  async claim(context: FamilyContext, memberId: string, actor: ActorContext): Promise<Member> {
    const row = await this.requireMember(context, memberId);

    const existingClaim = await this.prisma.familyMembership.findFirst({
      where: { claimedMemberId: memberId },
    });
    if (existingClaim && existingClaim.userId !== actor.userId) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'Someone else has already claimed that person as themselves.',
      });
    }

    await this.prisma.familyMembership.update({
      where: { id: context.membershipId },
      data: { claimedMemberId: memberId },
    });

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'MEMBER_CLAIMED',
      entityType: 'Member',
      entityId: memberId,
      summary: `Claimed ${row.displayName} as themselves`,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return toMember(row, { ...context, claimedMemberId: memberId }, await this.hideLiving(context));
  }

  // ----------------------------------------------------------------- helpers

  /**
   * The self-edit rule, which is not role-based and therefore cannot live in
   * the permission table: you may always edit your own record, whatever your
   * role, because people control their own representation.
   */
  private assertCanEdit(context: FamilyContext, memberId: string): void {
    if (roleHasPermission(context.role, Permission.MEMBER_UPDATE)) return;
    if (context.claimedMemberId === memberId) return;

    throw new ForbiddenException({
      code: ErrorCode.FORBIDDEN,
      message: `Your role in this family (${context.role.toLowerCase()}) cannot edit relatives.`,
    });
  }

  /**
   * findFirst, not findUnique - the tenant guard rejects findUnique on
   * family-owned models precisely so that "fetch by id" cannot be written
   * without a family scope.
   */
  private async requireMember(context: FamilyContext, memberId: string): Promise<MemberRow> {
    const row = (await this.prisma.scoped.member.findFirst({
      where: { id: memberId, familyId: context.familyId, deletedAt: null },
    })) as MemberRow | null;

    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'That person is not in this family tree.',
      });
    }
    return row;
  }

  private async hideLiving(context: FamilyContext): Promise<boolean> {
    const family = await this.prisma.family.findFirst({
      where: { id: context.familyId },
      select: { hideLivingFromViewers: true },
    });
    return family?.hideLivingFromViewers ?? true;
  }
}