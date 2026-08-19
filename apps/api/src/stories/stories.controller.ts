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
  createStoryInputSchema,
  updateStoryInputSchema,
  type CreateStoryInput,
  type OkResponse,
  type StoryListResponse,
  type StoryResponse,
  type UpdateStoryInput,
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
import { StoriesService } from './stories.service';

@ApiTags('stories')
@Controller('families/:familyId')
@UseGuards(FamilyMembershipGuard, PermissionGuard)
export class StoriesController {
  constructor(private readonly stories: StoriesService) {}

  @Get('stories')
  @ApiOperation({
    summary: 'Every story in this family',
    description:
      'Admin-only stories are omitted for roles that cannot see them, and an unapproved ' +
      'AI draft is visible only to the person who asked for it.',
  })
  async list(
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StoryListResponse> {
    return { stories: await this.stories.list(context, user.id) };
  }

  @Get('members/:memberId/stories')
  @ApiOperation({ summary: 'Stories about one person' })
  async listForMember(
    @Param('memberId') memberId: string,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StoryListResponse> {
    return { stories: await this.stories.listForMember(context, memberId, user.id) };
  }

  @Get('stories/:storyId')
  @ApiOperation({ summary: 'One story' })
  async getOne(
    @Param('storyId') storyId: string,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StoryResponse> {
    return { story: await this.stories.getOne(context, storyId, user.id) };
  }

  @Post('stories')
  @RequirePermission(Permission.STORY_CREATE)
  @ApiOperation({ summary: 'Write a story' })
  async create(
    @Body(new ZodValidationPipe(createStoryInputSchema)) body: CreateStoryInput,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<StoryResponse> {
    const story = await this.stories.create(context, body, this.actorFrom(user, request));
    return { story };
  }

  /**
   * No @RequirePermission, deliberately.
   *
   * The person who wrote a story may always edit it, whatever their role - the
   * same rule that lets someone edit their own member record. Enforced in the
   * service, because it is not role-based.
   */
  @Patch('stories/:storyId')
  @ApiOperation({
    summary: 'Edit a story',
    description: 'Requires story:update, OR that you wrote it.',
  })
  async update(
    @Param('storyId') storyId: string,
    @Body(new ZodValidationPipe(updateStoryInputSchema)) body: UpdateStoryInput,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<StoryResponse> {
    const story = await this.stories.update(
      context,
      storyId,
      body,
      this.actorFrom(user, request),
    );
    return { story };
  }

  @Post('stories/:storyId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Publish an AI-assisted draft',
    description:
      'Until this is called, the draft is visible only to the person who asked for it. This ' +
      'endpoint is what makes "AI never publishes on its own" a mechanism rather than a promise.',
  })
  async approve(
    @Param('storyId') storyId: string,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<StoryResponse> {
    const story = await this.stories.approveDraft(
      context,
      storyId,
      this.actorFrom(user, request),
    );
    return { story };
  }

  @Delete('stories/:storyId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove a story',
    description: 'Soft delete. Requires story:delete, OR that you wrote it.',
  })
  async remove(
    @Param('storyId') storyId: string,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<OkResponse> {
    await this.stories.remove(context, storyId, this.actorFrom(user, request));
    return { ok: true };
  }

  private actorFrom(user: AuthenticatedUser, request: FastifyRequest): ActorContext {
    return { userId: user.id, ip: request.ip, userAgent: request.headers['user-agent'] };
  }
}