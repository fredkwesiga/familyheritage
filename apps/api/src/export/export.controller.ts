import { Controller, Get, Header, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { toGedcom } from '@fh/shared';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Permission } from '../common/permissions';
import { CurrentFamily } from '../families/current-family.decorator';
import type { ActorContext } from '../families/families.service';
import { FamilyMembershipGuard } from '../families/family-membership.guard';
import type { FamilyContext } from '../families/family.types';
import { PermissionGuard } from '../families/permission.guard';
import { ExportService } from './export.service';

@ApiTags('export')
@Controller('families/:familyId/export')
@UseGuards(FamilyMembershipGuard, PermissionGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('json')
  @RequirePermission(Permission.FAMILY_EXPORT)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Download everything as JSON',
    description:
      'Complete: every person, link, story and photograph reference. This is the file to keep ' +
      'if the question is "could this be rebuilt from scratch?".',
  })
  async json(
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<unknown> {
    const data = await this.exportService.build(context, this.actorFrom(user, request));
    const filename = this.exportService.filenameFor(context.familyName, 'json');

    void reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return data;
  }

  @Get('gedcom')
  @RequirePermission(Permission.FAMILY_EXPORT)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Download as GEDCOM',
    description:
      'The genealogy interchange format, readable by Ancestry, MyHeritage, Gramps and most ' +
      'other software. Lossier than the JSON, and the reason this data is genuinely portable.',
  })
  async gedcom(
    @CurrentFamily() context: FamilyContext,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<string> {
    const data = await this.exportService.build(context, this.actorFrom(user, request));
    const filename = this.exportService.filenameFor(context.familyName, 'ged');

    void reply
      .header('Content-Type', 'text/vnd.familysearch.gedcom; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`);

    return toGedcom(data);
  }

  private actorFrom(user: AuthenticatedUser, request: FastifyRequest): ActorContext {
    return { userId: user.id, ip: request.ip, userAgent: request.headers['user-agent'] };
  }
}