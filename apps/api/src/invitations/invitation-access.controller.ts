import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import {
  acceptInvitationInputSchema,
  type AcceptInvitationInput,
  type AcceptInvitationResponse,
  type InvitationPreviewResponse,
} from '@fh/shared';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { InvitationsService } from './invitations.service';

/**
 * The two routes a person outside the family needs.
 *
 * Separate from the family-scoped controller because someone holding an
 * invitation is, by definition, not yet a member - FamilyMembershipGuard would
 * turn every one of them away.
 */
@ApiTags('invitations')
@Controller('invitations')
export class InvitationAccessController {
  constructor(private readonly invitations: InvitationsService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('preview')
  @ApiOperation({
    summary: 'What an invitation is for, before signing in',
    description:
      'Returns only the family name, who invited them and the role. Deliberately thin: this ' +
      'is readable by whoever holds the link, and a link gets forwarded.',
  })
  async preview(@Query('token') token: string): Promise<InvitationPreviewResponse> {
    if (!token) {
      return {
        preview: {
          familyName: '',
          invitedByName: null,
          email: '',
          role: 'VIEWER',
          status: 'NOT_FOUND',
        },
      };
    }
    return { preview: await this.invitations.preview(token) };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Join the family',
    description:
      'Requires a signed-in user whose email matches the invited address. That restriction ' +
      'is what stops a forwarded link granting access to a family’s private history.',
  })
  async accept(
    @Body(new ZodValidationPipe(acceptInvitationInputSchema)) body: AcceptInvitationInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<AcceptInvitationResponse> {
    return this.invitations.accept(
      body.token,
      { id: user.id, email: user.email },
      { ip: request.ip, userAgent: request.headers['user-agent'] },
    );
  }
}