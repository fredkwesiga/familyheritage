import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { ErrorCode } from '@fh/shared';
import { REQUIRED_PERMISSION_KEY } from '../common/decorators/require-permission.decorator';
import { roleHasPermission, type Permission } from '../common/permissions';

/**
 * Checks the permission declared by @RequirePermission against the role in the
 * FamilyContext. Must run after FamilyMembershipGuard - without a context there
 * is no role to check, and this guard fails closed.
 *
 * 403 here rather than 404: the user is a member of this family and knows it
 * exists, so there is nothing left to conceal. Telling them plainly that their
 * role is insufficient is more useful than pretending the route is missing.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission | undefined>(
      REQUIRED_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No declared permission means membership alone is enough - read routes.
    if (!required) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const familyContext = request.familyContext;

    if (!familyContext) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'This action requires a family context.',
      });
    }

    if (!roleHasPermission(familyContext.role, required)) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: `Your role in this family (${familyContext.role.toLowerCase()}) cannot do that.`,
      });
    }

    return true;
  }
}