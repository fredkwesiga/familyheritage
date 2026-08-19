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
  confirmPhotoInputSchema,
  updatePhotoInputSchema,
  type ConfirmPhotoInput,
  type OkResponse,
  type PhotoListResponse,
  type PhotoResponse,
  type UpdatePhotoInput,
  type UploadTargetResponse,
  type MemberAvatarsResponse,
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
import { PhotosService } from './photos.service';

const setPrimarySchema = z.object({ photoId: z.string().uuid().nullable() });

@ApiTags('photos')
@Controller('families/:familyId')
@UseGuards(FamilyMembershipGuard, PermissionGuard)
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Post('photos/upload-target')
  @RequirePermission(Permission.PHOTO_UPLOAD)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Signed parameters for a direct upload',
    description:
      'The browser uploads straight to the storage provider using these. Bytes never pass ' +
      'through this API, which keeps a family photo album from having to fit through a ' +
      '512 MB instance.',
  })
  uploadTarget(@CurrentFamily() context: FamilyContext): UploadTargetResponse {
    return { target: this.photos.createUploadTarget(context) };
  }

  @Post('photos')
  @RequirePermission(Permission.PHOTO_UPLOAD)
  @ApiOperation({
    summary: 'Record a completed upload',
    description:
      'Nothing the client reports about the file is trusted: the provider is asked what is ' +
      'actually stored, and the asset must sit inside this family\u2019s folder.',
  })
  async confirm(
    @Body(new ZodValidationPipe(confirmPhotoInputSchema)) body: ConfirmPhotoInput,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<PhotoResponse> {
    const photo = await this.photos.confirm(context, body, this.actorFrom(user, request));
    return { photo };
  }

  @Get('photos')
  @ApiOperation({ summary: 'Every photograph in this family' })
  async list(@CurrentFamily() context: FamilyContext): Promise<PhotoListResponse> {
    return { photos: await this.photos.listForFamily(context) };
  }

    @Get('photos/member-avatars')
  @ApiOperation({
    summary: 'Signed thumbnail URLs for every member with a profile picture',
    description:
      'One request for the whole family, so the member list, the relations panel and the ' +
      'tree can all show faces without any of them knowing about photo storage.',
  })
  async memberAvatars(
    @CurrentFamily() context: FamilyContext,
  ): Promise<MemberAvatarsResponse> {
    return { avatars: await this.photos.memberAvatars(context) };
  }

  @Get('members/:memberId/photos')
  @ApiOperation({ summary: 'Photographs someone appears in' })
  async listForMember(
    @Param('memberId') memberId: string,
    @CurrentFamily() context: FamilyContext,
  ): Promise<PhotoListResponse> {
    return { photos: await this.photos.listForMember(context, memberId) };
  }

  @Patch('photos/:photoId')
  @RequirePermission(Permission.PHOTO_UPLOAD)
  @ApiOperation({ summary: 'Edit a caption, date, place, or who appears in it' })
  async update(
    @Param('photoId') photoId: string,
    @Body(new ZodValidationPipe(updatePhotoInputSchema)) body: UpdatePhotoInput,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<PhotoResponse> {
    const photo = await this.photos.update(
      context,
      photoId,
      body,
      this.actorFrom(user, request),
    );
    return { photo };
  }

  @Post('members/:memberId/primary-photo')
  @RequirePermission(Permission.PHOTO_UPLOAD)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Choose which photograph represents someone',
    description: 'Send null to remove it. The photograph itself is never altered.',
  })
  async setPrimary(
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(setPrimarySchema)) body: { photoId: string | null },
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<OkResponse> {
    await this.photos.setPrimary(
      context,
      memberId,
      body.photoId,
      this.actorFrom(user, request),
    );
    return { ok: true };
  }

  @Delete('photos/:photoId')
  @RequirePermission(Permission.PHOTO_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove a photograph',
    description: 'Soft delete. The stored file is kept, and the record can be restored.',
  })
  async remove(
    @Param('photoId') photoId: string,
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<OkResponse> {
    await this.photos.remove(context, photoId, this.actorFrom(user, request));
    return { ok: true };
  }

  private actorFrom(user: AuthenticatedUser, request: FastifyRequest): ActorContext {
    return { userId: user.id, ip: request.ip, userAgent: request.headers['user-agent'] };
  }
}