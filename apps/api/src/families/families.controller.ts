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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  changeRoleInputSchema,
  createFamilyInputSchema,
  transferOwnershipInputSchema,
  updateFamilyInputSchema,
  type ChangeRoleInput,
  type CreateFamilyInput,
  type FamilyAccessList,
  type FamilyListResponse,
  type FamilyResponse,
  type OkResponse,
  type TransferOwnershipInput,
  type UpdateFamilyInput,
} from '@fh/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Permission } from '../common/permissions';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentFamily } from './current-family.decorator';
import { FamiliesService, type ActorContext } from './families.service';
import { FamilyMembershipGuard } from './family-membership.guard';
import type { FamilyContext } from './family.types';
import { PermissionGuard } from './permission.guard';

const deleteFamilySchema = z.object({ confirmFamilyName: z.string() });

@ApiTags('families')
@Controller('families')
export class FamiliesController {
  constructor(private readonly families: FamiliesService) {}

  // --- Routes with no :familyId - scope is the user, not a family -----------

  @Post()
  @ApiOperation({ summary: 'Create a family and become its owner' })
  async create(
    @Body(new ZodValidationPipe(createFamilyInputSchema)) body: CreateFamilyInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<FamilyResponse> {
    const family = await this.families.create(body, this.actorFrom(user, request));
    return { family };
  }

  @Get()
  @ApiOperation({ summary: 'List every family you belong to' })
  async list(@CurrentUser() user: AuthenticatedUser): Promise<FamilyListResponse> {
    return { families: await this.families.listForUser(user.id) };
  }

  // --- Everything below is family-scoped ------------------------------------
  //
  // FamilyMembershipGuard proves membership and attaches the FamilyContext.
  // PermissionGuard then checks @RequirePermission against the role in it.
  // Order matters: without a context there is no role, and PermissionGuard
  // fails closed.

  @Get(':familyId')
  @UseGuards(FamilyMembershipGuard, PermissionGuard)
  @ApiOperation({ summary: 'One family, with your role in it' })
  async getOne(@CurrentFamily() context: FamilyContext): Promise<FamilyResponse> {
    return { family: await this.families.getOne(context) };
  }

  @Patch(':familyId')
  @UseGuards(FamilyMembershipGuard, PermissionGuard)
  @RequirePermission(Permission.FAMILY_UPDATE)
  @ApiOperation({ summary: 'Update the family name, description or settings' })
  async update(
    @Body(new ZodValidationPipe(updateFamilyInputSchema)) body: UpdateFamilyInput,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<FamilyResponse> {
    const family = await this.families.update(context, body, this.actorFrom(user, request));
    return { family };
  }

  @Delete(':familyId')
  @UseGuards(FamilyMembershipGuard, PermissionGuard)
  @RequirePermission(Permission.FAMILY_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a family',
    description:
      'Soft delete. Requires typing the family name to confirm, and nothing is erased - ' +
      'the rows remain and can be restored.',
  })
  async remove(
    @Body(new ZodValidationPipe(deleteFamilySchema)) body: { confirmFamilyName: string },
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<OkResponse> {
    await this.families.softDelete(
      context,
      body.confirmFamilyName,
      this.actorFrom(user, request),
    );
    return { ok: true };
  }

  // --- Who can see this family ---------------------------------------------

  @Get(':familyId/access')
  @UseGuards(FamilyMembershipGuard, PermissionGuard)
  @ApiOperation({ summary: 'People who can sign in and see this family' })
  async listAccess(
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FamilyAccessList> {
    return { access: await this.families.listAccess(context, user.id) };
  }

  @Patch(':familyId/access/:userId')
  @UseGuards(FamilyMembershipGuard, PermissionGuard)
  @RequirePermission(Permission.ACCESS_CHANGE_ROLE)
  @ApiOperation({ summary: "Change someone's role in this family" })
  async changeRole(
    @Param('userId') targetUserId: string,
    @Body(new ZodValidationPipe(changeRoleInputSchema)) body: ChangeRoleInput,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<OkResponse> {
    await this.families.changeRole(
      context,
      targetUserId,
      body.role,
      this.actorFrom(user, request),
    );
    return { ok: true };
  }

  @Delete(':familyId/access/:userId')
  @UseGuards(FamilyMembershipGuard, PermissionGuard)
  @RequirePermission(Permission.ACCESS_REVOKE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove someone's access to this family" })
  async revokeAccess(
    @Param('userId') targetUserId: string,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<OkResponse> {
    await this.families.revokeAccess(context, targetUserId, this.actorFrom(user, request));
    return { ok: true };
  }

  @Post(':familyId/transfer-ownership')
  @UseGuards(FamilyMembershipGuard, PermissionGuard)
  @RequirePermission(Permission.ACCESS_TRANSFER_OWNERSHIP)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hand ownership to another member',
    description:
      'The outgoing owner becomes an admin rather than losing access - the usual reason to ' +
      'transfer is succession, not expulsion.',
  })
  async transferOwnership(
    @Body(new ZodValidationPipe(transferOwnershipInputSchema)) body: TransferOwnershipInput,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<OkResponse> {
    await this.families.transferOwnership(
      context,
      body.toUserId,
      body.confirmFamilyName,
      this.actorFrom(user, request),
    );
    return { ok: true };
  }

  private actorFrom(user: AuthenticatedUser, request: FastifyRequest): ActorContext {
    return {
      userId: user.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };
  }
}