import { createParamDecorator, InternalServerErrorException, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { FamilyContext } from './family.types';

/**
 * Injects the verified FamilyContext.
 *
 * Throws rather than returning undefined: a handler reaching for this without
 * FamilyMembershipGuard in front of it is a wiring bug, and it should fail
 * immediately and loudly rather than operate on an unverified familyId.
 */
export const CurrentFamily = createParamDecorator(
  (_data: unknown, context: ExecutionContext): FamilyContext => {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (!request.familyContext) {
      throw new InternalServerErrorException(
        'Route is missing FamilyMembershipGuard; no family context available.',
      );
    }
    return request.familyContext;
  },
);