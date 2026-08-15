import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ErrorCode, type Family, type FamilyAccessEntry, type FamilySummary } from '@fh/shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { FamilyContext } from './family.types';

export interface ActorContext {
  userId: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class FamiliesService {
  private readonly logger = new Logger(FamiliesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ create

  /**
   * Creates a family and makes the caller its OWNER, in one transaction.
   *
   * These two writes must not be separable. A family with no owner is
   * unreachable by anyone, including support - there is no route that would let
   * a human recover it.
   */
  async create(
    input: { name: string; description?: string },
    actor: ActorContext,
  ): Promise<Family> {
    const created = await this.prisma.$transaction(async (tx) => {
      const family = await tx.family.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          // Both defaults are the cautious ones: living relatives' details are
          // hidden from viewers, and AI is off until a human turns it on.
          hideLivingFromViewers: true,
          aiEnabled: false,
        },
      });

      await tx.familyMembership.create({
        data: { userId: actor.userId, familyId: family.id, role: 'OWNER' },
      });

      return family;
    });

    await this.audit.record({
      familyId: created.id,
      actorUserId: actor.userId,
      action: 'FAMILY_CREATED',
      entityType: 'Family',
      entityId: created.id,
      summary: `Created the family "${created.name}"`,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return {
      id: created.id,
      name: created.name,
      description: created.description,
      hideLivingFromViewers: created.hideLivingFromViewers,
      aiEnabled: created.aiEnabled,
      memberCount: 0,
      yourRole: 'OWNER',
      yourClaimedMemberId: null,
      createdAt: created.createdAt.toISOString(),
    };
  }

  // -------------------------------------------------------------------- read

  /** Every family this user belongs to. The only unscoped list in the API. */
  async listForUser(userId: string): Promise<FamilySummary[]> {
    const memberships = await this.prisma.familyMembership.findMany({
      where: { userId, family: { deletedAt: null } },
      include: {
        family: {
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            _count: { select: { members: { where: { deletedAt: null } } } },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((membership) => ({
      id: membership.family.id,
      name: membership.family.name,
      description: membership.family.description,
      memberCount: membership.family._count.members,
      yourRole: membership.role,
      createdAt: membership.family.createdAt.toISOString(),
    }));
  }

  async getOne(context: FamilyContext): Promise<Family> {
    const family = await this.prisma.family.findFirst({
      where: { id: context.familyId, deletedAt: null },
      include: { _count: { select: { members: { where: { deletedAt: null } } } } },
    });

    if (!family) throw this.notFound();

    return {
      id: family.id,
      name: family.name,
      description: family.description,
      hideLivingFromViewers: family.hideLivingFromViewers,
      aiEnabled: family.aiEnabled,
      memberCount: family._count.members,
      yourRole: context.role,
      yourClaimedMemberId: context.claimedMemberId,
      createdAt: family.createdAt.toISOString(),
    };
  }

  // ------------------------------------------------------------------ update

  async update(
    context: FamilyContext,
    input: {
      name?: string;
      description?: string | null;
      hideLivingFromViewers?: boolean;
      aiEnabled?: boolean;
    },
    actor: ActorContext,
  ): Promise<Family> {
    const before = await this.prisma.family.findFirst({
      where: { id: context.familyId, deletedAt: null },
    });
    if (!before) throw this.notFound();

    const updated = await this.prisma.family.update({
      where: { id: context.familyId },
      data: input,
      include: { _count: { select: { members: { where: { deletedAt: null } } } } },
    });

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'FAMILY_UPDATED',
      entityType: 'Family',
      entityId: context.familyId,
      summary: 'Updated family settings',
      diff: AuditService.diffOf(
        {
          name: before.name,
          description: before.description,
          hideLivingFromViewers: before.hideLivingFromViewers,
          aiEnabled: before.aiEnabled,
        },
        input,
      ),
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      hideLivingFromViewers: updated.hideLivingFromViewers,
      aiEnabled: updated.aiEnabled,
      memberCount: updated._count.members,
      yourRole: context.role,
      yourClaimedMemberId: context.claimedMemberId,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * Soft delete. The rows stay, and an administrator can restore them.
   *
   * A family archive is not the kind of thing anyone should be able to destroy
   * by misreading a confirmation dialog.
   */
  async softDelete(context: FamilyContext, confirmName: string, actor: ActorContext): Promise<void> {
    if (confirmName.trim() !== context.familyName) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'The family name you typed does not match.',
      });
    }

    await this.prisma.family.update({
      where: { id: context.familyId },
      data: { deletedAt: new Date() },
    });

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'FAMILY_UPDATED',
      entityType: 'Family',
      entityId: context.familyId,
      summary: `Deleted the family "${context.familyName}"`,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  }

  // ------------------------------------------------------------------ access

  async listAccess(context: FamilyContext, viewerUserId: string): Promise<FamilyAccessEntry[]> {
    const memberships = await this.prisma.familyMembership.findMany({
      where: { familyId: context.familyId },
      include: { user: { select: { id: true, email: true, name: true, deletedAt: true } } },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships
      .filter((membership) => membership.user.deletedAt === null)
      .map((membership) => ({
        userId: membership.user.id,
        email: membership.user.email,
        name: membership.user.name,
        role: membership.role,
        claimedMemberId: membership.claimedMemberId,
        joinedAt: membership.joinedAt.toISOString(),
        isYou: membership.user.id === viewerUserId,
      }));
  }

  async changeRole(
    context: FamilyContext,
    targetUserId: string,
    role: 'ADMIN' | 'CONTRIBUTOR' | 'VIEWER',
    actor: ActorContext,
  ): Promise<void> {
    const target = await this.requireMembership(context.familyId, targetUserId);

    // The owner is the last line of recovery for a family. Demoting them - or
    // letting them demote themselves - can orphan the archive entirely.
    if (target.role === 'OWNER') {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'The owner\u2019s role cannot be changed here. Transfer ownership instead.',
      });
    }

    // An admin demoting the admin who is demoting them, simultaneously, is a
    // race we simply avoid: nobody changes their own role.
    if (targetUserId === actor.userId) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'You cannot change your own role.',
      });
    }

    await this.prisma.familyMembership.update({
      where: { userId_familyId: { userId: targetUserId, familyId: context.familyId } },
      data: { role },
    });

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'ROLE_CHANGED',
      entityType: 'FamilyMembership',
      entityId: target.id,
      summary: `Changed a member's role from ${target.role} to ${role}`,
      diff: AuditService.diffOf({ role: target.role }, { role }),
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  }

  async revokeAccess(
    context: FamilyContext,
    targetUserId: string,
    actor: ActorContext,
  ): Promise<void> {
    const target = await this.requireMembership(context.familyId, targetUserId);

    if (target.role === 'OWNER') {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'The owner cannot be removed. Transfer ownership first.',
      });
    }

    await this.prisma.familyMembership.delete({
      where: { userId_familyId: { userId: targetUserId, familyId: context.familyId } },
    });

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'ROLE_CHANGED',
      entityType: 'FamilyMembership',
      entityId: target.id,
      summary: 'Removed a person\u2019s access to this family',
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  }

  /**
   * Moves ownership to another member, in one transaction.
   *
   * The outgoing owner becomes an ADMIN rather than losing access, because the
   * common reason to transfer is succession, not expulsion.
   */
  async transferOwnership(
    context: FamilyContext,
    toUserId: string,
    confirmFamilyName: string,
    actor: ActorContext,
  ): Promise<void> {
    if (confirmFamilyName.trim() !== context.familyName) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'The family name you typed does not match.',
      });
    }

    if (toUserId === actor.userId) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'You already own this family.',
      });
    }

    await this.requireMembership(context.familyId, toUserId);

    await this.prisma.$transaction([
      this.prisma.familyMembership.update({
        where: { userId_familyId: { userId: actor.userId, familyId: context.familyId } },
        data: { role: 'ADMIN' },
      }),
      this.prisma.familyMembership.update({
        where: { userId_familyId: { userId: toUserId, familyId: context.familyId } },
        data: { role: 'OWNER' },
      }),
    ]);

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'ROLE_CHANGED',
      entityType: 'Family',
      entityId: context.familyId,
      summary: 'Transferred ownership of this family',
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  }

  // ----------------------------------------------------------------- helpers

  private async requireMembership(familyId: string, userId: string) {
    const membership = await this.prisma.familyMembership.findUnique({
      where: { userId_familyId: { userId, familyId } },
    });
    if (!membership) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'That person does not have access to this family.',
      });
    }
    return membership;
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: ErrorCode.NOT_FOUND,
      message: 'That family does not exist, or you do not have access to it.',
    });
  }
}