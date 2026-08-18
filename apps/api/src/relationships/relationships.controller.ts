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
import {
  addRelativeInputSchema,
  createParentChildInputSchema,
  createPartnershipInputSchema,
  updatePartnershipInputSchema,
  type AddRelativeInput,
  type CreateParentChildInput,
  type CreatePartnershipInput,
  type MemberRelationsResponse,
  type MemberSummary,
  type OkResponse,
  type UpdatePartnershipInput,
  type RelationshipAnswerResponse,
  type FamilyTreeResponse,
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
import { RelationshipsService } from './relationships.service';

@ApiTags('relationships')
@Controller('families/:familyId')
@UseGuards(FamilyMembershipGuard, PermissionGuard)
export class RelationshipsController {
  constructor(private readonly relationships: RelationshipsService) { }

  @Get('tree')
  @ApiOperation({
    summary: 'The whole family graph',
    description:
      'Every living record, every parent-child link and every partnership, in one response. ' +
      'The client can then re-centre the tree on anyone without another request.',
  })
  async tree(@CurrentFamily() context: FamilyContext): Promise<FamilyTreeResponse> {
    return { tree: await this.relationships.tree(context) };
  }

  @Get('members/:memberId/relations')
  @ApiOperation({
    summary: 'Parents, children, partners and siblings',
    description:
      'Siblings are computed from shared parents on every request, never stored. Only ' +
      'biological and adoptive links count toward them.',
  })
  async relations(
    @Param('memberId') memberId: string,
    @CurrentFamily() context: FamilyContext,
  ): Promise<MemberRelationsResponse> {
    return { relations: await this.relationships.relationsOf(context, memberId) };
  }

  @Get('members/:memberId/relationship-to/:otherMemberId')
  @ApiOperation({
    summary: 'How is one person related to another?',
    description:
      'Computed from the family graph by a deterministic engine - lowest common ancestors, ' +
      'then degree and removal from the two path depths. No language model is involved, and ' +
      'the answer is identical every time it is asked.',
  })
  async relationshipTo(
    @Param('memberId') memberId: string,
    @Param('otherMemberId') otherMemberId: string,
    @CurrentFamily() context: FamilyContext,
  ): Promise<RelationshipAnswerResponse> {
    return {
      relationship: await this.relationships.relationshipBetween(
        context,
        memberId,
        otherMemberId,
      ),
    };
  }



  @Post('members/:memberId/relatives')
  @RequirePermission(Permission.MEMBER_CREATE)
  @ApiOperation({
    summary: 'Add a relative to someone, in one step',
    description:
      'Creates the person and the link together. The relationship comes from which button ' +
      'the user pressed, so it never has to be chosen from a list.',
  })
  async addRelative(
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(addRelativeInputSchema)) body: AddRelativeInput,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<{ member: MemberSummary }> {
    const member = await this.relationships.addRelative(
      context,
      memberId,
      body,
      this.actorFrom(user, request),
    );
    return { member };
  }

  @Post('relationships/parent-child')
  @RequirePermission(Permission.RELATIONSHIP_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link two existing people as parent and child' })
  async linkParentChild(
    @Body(new ZodValidationPipe(createParentChildInputSchema)) body: CreateParentChildInput,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<OkResponse> {
    await this.relationships.linkParentChild(context, body, this.actorFrom(user, request));
    return { ok: true };
  }

  @Delete('relationships/parent-child/:linkId')
  @RequirePermission(Permission.RELATIONSHIP_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove a parent-child link',
    description: 'Both people stay in the tree. Only the link between them is removed.',
  })
  async unlinkParentChild(
    @Param('linkId') linkId: string,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<OkResponse> {
    await this.relationships.unlinkParentChild(context, linkId, this.actorFrom(user, request));
    return { ok: true };
  }

  @Post('relationships/partnerships')
  @RequirePermission(Permission.RELATIONSHIP_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record a marriage or partnership',
    description:
      'A remarriage is a second row, not an edit of the first - the earlier partnership ' +
      'remains part of the family record.',
  })
  async createPartnership(
    @Body(new ZodValidationPipe(createPartnershipInputSchema)) body: CreatePartnershipInput,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<OkResponse> {
    await this.relationships.createPartnership(context, body, this.actorFrom(user, request));
    return { ok: true };
  }

  @Patch('relationships/partnerships/:linkId')
  @RequirePermission(Permission.RELATIONSHIP_WRITE)
  @ApiOperation({ summary: 'Update a partnership — its dates, place or status' })
  async updatePartnership(
    @Param('linkId') linkId: string,
    @Body(new ZodValidationPipe(updatePartnershipInputSchema)) body: UpdatePartnershipInput,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<OkResponse> {
    await this.relationships.updatePartnership(
      context,
      linkId,
      body,
      this.actorFrom(user, request),
    );
    return { ok: true };
  }

  @Delete('relationships/partnerships/:linkId')
  @RequirePermission(Permission.RELATIONSHIP_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a partnership' })
  async deletePartnership(
    @Param('linkId') linkId: string,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<OkResponse> {
    await this.relationships.deletePartnership(context, linkId, this.actorFrom(user, request));
    return { ok: true };
  }

  private actorFrom(user: AuthenticatedUser, request: FastifyRequest): ActorContext {
    return { userId: user.id, ip: request.ip, userAgent: request.headers['user-agent'] };
  }
}