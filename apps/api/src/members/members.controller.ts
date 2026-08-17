import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import {
  createMemberInputSchema,
  markDeceasedInputSchema,
  setLivingStatusInputSchema,
  updateMemberInputSchema,
  type CreateMemberInput,
  type MarkDeceasedInput,
  type MemberListResponse,
  type MemberResponse,
  type OkResponse,
  type SetLivingStatusInput,
  type UpdateMemberInput,
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
import { MembersService } from './members.service';

@ApiTags('members')
@Controller('families/:familyId/members')
@UseGuards(FamilyMembershipGuard, PermissionGuard)
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @ApiOperation({
    summary: 'Everyone in this family tree',
    description:
      'Living relatives may come back with details withheld (isRedacted) depending on the ' +
      "viewer's role and the family's privacy setting.",
  })
  async list(
    @CurrentFamily() context: FamilyContext,
    @Query('includeDeleted') includeDeleted?: string,
  ): Promise<MemberListResponse> {
    return this.members.list(context, { includeDeleted: includeDeleted === 'true' });
  }

  @Post()
  @RequirePermission(Permission.MEMBER_CREATE)
  @ApiOperation({
    summary: 'Add a person to the tree',
    description: 'Only a name is required. Everything else can be filled in later, or never.',
  })
  async create(
    @Body(new ZodValidationPipe(createMemberInputSchema)) body: CreateMemberInput,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<MemberResponse> {
    const member = await this.members.create(context, body, this.actorFrom(user, request));
    return { member };
  }

  @Get(':memberId')
  @ApiOperation({ summary: 'One person, in full' })
  async getOne(
    @Param('memberId') memberId: string,
    @CurrentFamily() context: FamilyContext,
  ): Promise<MemberResponse> {
    return { member: await this.members.getOne(context, memberId) };
  }

  /**
   * No @RequirePermission here, deliberately.
   *
   * A user may always edit the record they have claimed as themselves, whatever
   * their role. That rule is not role-based, so it cannot live in the permission
   * table - MembersService.assertCanEdit enforces it instead.
   */
  @Patch(':memberId')
  @ApiOperation({
    summary: 'Edit a person',
    description:
      'Requires member:update, OR that this is the record you have claimed as yourself.',
  })
  async update(
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(updateMemberInputSchema)) body: UpdateMemberInput,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<MemberResponse> {
    const member = await this.members.update(
      context,
      memberId,
      body,
      this.actorFrom(user, request),
    );
    return { member };
  }

  @Post(':memberId/deceased')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record that someone has passed away',
    description:
      'A date is not required - families often know that a relative died without knowing ' +
      'when. Nothing is deleted: the photograph and every other record are preserved exactly ' +
      'as they were, and only how they are displayed changes.',
  })
  async markDeceased(
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(markDeceasedInputSchema)) body: MarkDeceasedInput,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<MemberResponse> {
    const member = await this.members.markDeceased(
      context,
      memberId,
      body,
      this.actorFrom(user, request),
    );
    return { member };
  }

  @Post(':memberId/living-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Correct a living status',
    description: 'Reverses a mistake, or records that we simply do not know.',
  })
  async setLivingStatus(
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(setLivingStatusInputSchema)) body: SetLivingStatusInput,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<MemberResponse> {
    const member = await this.members.setLivingStatus(
      context,
      memberId,
      body,
      this.actorFrom(user, request),
    );
    return { member };
  }

  @Post(':memberId/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Say that this person is you',
    description:
      'Grants the right to edit your own record regardless of role, and is what makes ' +
      'relationship questions answerable from your own position in the tree.',
  })
  async claim(
    @Param('memberId') memberId: string,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<MemberResponse> {
    const member = await this.members.claim(context, memberId, this.actorFrom(user, request));
    return { member };
  }

  @Delete(':memberId')
  @RequirePermission(Permission.MEMBER_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove a person from the tree',
    description: 'Soft delete. The record remains and can be restored.',
  })
  async remove(
    @Param('memberId') memberId: string,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<OkResponse> {
    await this.members.softDelete(context, memberId, this.actorFrom(user, request));
    return { ok: true };
  }

  @Post(':memberId/restore')
  @RequirePermission(Permission.MEMBER_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Put a removed person back in the tree' })
  async restore(
    @Param('memberId') memberId: string,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<MemberResponse> {
    const member = await this.members.restore(context, memberId, this.actorFrom(user, request));
    return { member };
  }

  private actorFrom(user: AuthenticatedUser, request: FastifyRequest): ActorContext {
    return { userId: user.id, ip: request.ip, userAgent: request.headers['user-agent'] };
  }
}