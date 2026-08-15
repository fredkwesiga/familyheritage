import { createParamDecorator, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { AuthenticatedUser } from '../../auth/auth.types';

/**
 * Injects the authenticated user. Throws rather than returning undefined, so a
 * controller can never accidentally operate on an anonymous request.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (!request.authUser) {
      throw new UnauthorizedException('Authentication required.');
    }
    return request.authUser;
  },
);