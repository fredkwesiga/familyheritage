import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { ErrorCode } from '@fh/shared';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { SESSION_COOKIE } from './auth.types';
import { SessionService } from './session.service';

/**
 * Registered globally in AppModule, so every route is protected unless it is
 * explicitly marked @Public().
 *
 * Deny-by-default is the whole point: a developer who forgets the decorator
 * gets a locked route and a bug report. The inverse default gets a data leak
 * and no bug report.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = request.cookies?.[SESSION_COOKIE];

    // Public routes still resolve the session when one is present, so a
    // handler can behave differently for a signed-in visitor.
    if (token) {
      const resolved = await this.sessions.resolve(token);
      if (resolved) {
        request.authUser = resolved.user;
        request.authSessionId = resolved.sessionId;
      }
    }

    if (isPublic) return true;

    if (!request.authUser) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHENTICATED,
        message: 'You need to sign in to do that.',
      });
    }

    return true;
  }
}