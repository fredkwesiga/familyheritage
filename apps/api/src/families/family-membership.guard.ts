import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { ErrorCode } from '@fh/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { FamilyContext } from './family.types';

/**
 * Layer 1 of tenant isolation.
 *
 * Resolves :familyId from the route and proves the authenticated user has an
 * active membership in that family. On success it attaches a FamilyContext, and
 * from that point on nothing downstream needs to think about tenancy again.
 *
 * The failure is 404, not 403 - deliberately.
 *
 * A 403 would confirm that the family exists, which lets anyone with a valid
 * account walk a list of UUIDs and learn which ones are real. "Not found" is
 * both true from this user's perspective and silent about everything else. The
 * same reasoning applies to a soft-deleted family.
 */
@Injectable()
export class FamilyMembershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const params = (request.params ?? {}) as Record<string, string | undefined>;
    const familyId = params['familyId'];

    // AuthGuard runs first and has already rejected anonymous requests.
    const userId = request.authUser?.id;

    if (!familyId || !userId) {
      throw this.notFound();
    }

    // Rejecting a malformed id here keeps Postgres from raising a uuid parse
    // error, which would surface as a 500 and leak the shape of our storage.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(familyId)) {
      throw this.notFound();
    }

    const membership = await this.prisma.familyMembership.findUnique({
      where: { userId_familyId: { userId, familyId } },
      include: { family: { select: { id: true, name: true, deletedAt: true } } },
    });

    if (!membership || membership.family.deletedAt !== null) {
      throw this.notFound();
    }

    const familyContext: FamilyContext = {
      familyId: membership.familyId,
      familyName: membership.family.name,
      role: membership.role,
      membershipId: membership.id,
      claimedMemberId: membership.claimedMemberId,
    };

    request.familyContext = familyContext;
    return true;
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: ErrorCode.NOT_FOUND,
      message: 'That family does not exist, or you do not have access to it.',
    });
  }
}