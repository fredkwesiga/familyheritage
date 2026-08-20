import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import {
  createInvitationInputSchema,
  type CreateInvitationInput,
  type InvitationListResponse,
  type InvitationResponse,
  type OkResponse,
} from '@fh/shared';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Permission } from '../common/permissions';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentFamily } from '../families/current-family.decorator';
import type { ActorContext } from '../families/families.service';
import { FamilyMembershipGuard } from '../families/family-membership.guard';
import type { FamilyContext } from '../families/family.types';
import { PermissionGuard } from '../families/permission.guard';
import { InvitationsService } from './invitations.service';

@ApiTags('invitations')
@Controller('families/:familyId/invitations')
@UseGuards(FamilyMembershipGuard, PermissionGuard)
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get()
  @RequirePermission(Permission.ACCESS_INVITE)
  @ApiOperation({ summary: 'Invitations sent but not yet accepted' })
  async list(@CurrentFamily() context: FamilyContext): Promise<InvitationListResponse> {
    return { invitations: await this.invitations.listPending(context) };
  }

  // Ten a minute. Enough to invite a whole family in one sitting, low enough
  // that the endpoint cannot be used to send mail to strangers at volume.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @RequirePermission(Permission.ACCESS_INVITE)
  @ApiOperation({
    summary: 'Invite someone to this family',
    description:
      'Sends a one-time link, valid for a week. Re-inviting the same address replaces any ' +
      'outstanding invitation rather than adding a second live link.',
  })
  async invite(
    @Body(new ZodValidationPipe(createInvitationInputSchema)) body: CreateInvitationInput,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<InvitationResponse> {
    const invitation = await this.invitations.invite(
      context,
      body,
      this.actorFrom(user, request),
    );
    return { invitation };
  }

  @Delete(':invitationId')
  @RequirePermission(Permission.ACCESS_INVITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an invitation' })
  async revoke(
    @Param('invitationId') invitationId: string,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<OkResponse> {
    await this.invitations.revoke(context, invitationId, this.actorFrom(user, request));
    return { ok: true };
  }

  private actorFrom(user: AuthenticatedUser, request: FastifyRequest): ActorContext {
    return { userId: user.id, ip: request.ip, userAgent: request.headers['user-agent'] };
  }
}