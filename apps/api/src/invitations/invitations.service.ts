import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ErrorCode,
  INVITATION_TTL_DAYS,
  type AcceptInvitationResponse,
  type CreateInvitationInput,
  type Invitation,
  type InvitationPreview,
} from '@fh/shared';
import { ConfigService } from '@nestjs/config';
import { generateToken, hashToken } from '../auth/token.util';
import { AuditService } from '../audit/audit.service';
import type { Env } from '../config/env.schema';
import { EmailService } from '../email/email.service';
import type { ActorContext } from '../families/families.service';
import type { FamilyContext } from '../families/family.types';
import { PrismaService } from '../prisma/prisma.service';

interface InvitationRow {
  id: string;
  familyId: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'CONTRIBUTOR' | 'VIEWER';
  tokenHash: string;
  invitedById: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  invitedBy?: { name: string | null; email: string } | null;
  family?: { id: string; name: string; deletedAt: Date | null } | null;
}

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ------------------------------------------------------------------ create

  async invite(
    context: FamilyContext,
    input: CreateInvitationInput,
    actor: ActorContext,
  ): Promise<Invitation> {
    const email = input.email.trim().toLowerCase();

    // Someone already inside the family does not need an invitation, and
    // sending one would imply they are not there.
    const existingMember = await this.prisma.familyMembership.findFirst({
      where: { familyId: context.familyId, user: { email } },
    });
    if (existingMember) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'That person already has access to this family.',
      });
    }

    const inviter = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: { name: true, email: true },
    });

    const token = generateToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

    // Re-inviting replaces any outstanding invitation rather than adding a
    // second, so "resend" cannot leave two live links in circulation.
    const [, row] = await this.prisma.$transaction([
      this.prisma.scoped.invitation.deleteMany({
        where: { familyId: context.familyId, email, acceptedAt: null },
      }),
      this.prisma.scoped.invitation.create({
        data: {
          familyId: context.familyId,
          email,
          role: input.role,
          tokenHash: hashToken(token),
          invitedById: actor.userId,
          expiresAt,
        },
        include: { invitedBy: { select: { name: true, email: true } } },
      }),
    ]);

    const invitation = row as InvitationRow;
    const base = this.config.get('APP_URL', { infer: true }).replace(/\/$/, '');

    await this.email
      .sendInvitation(email, {
        familyName: context.familyName,
        invitedByName: inviter?.name ?? inviter?.email ?? null,
        note: input.message,
        url: `${base}/invitations/accept?token=${encodeURIComponent(token)}`,
      })
      .catch((error: unknown) => {
        // The invitation row is already written, so a failed send is
        // recoverable by resending rather than a reason to lose the record.
        this.logger.warn(`Could not send invitation email: ${String(error)}`);
      });

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'INVITATION_CREATED',
      entityType: 'Invitation',
      entityId: invitation.id,
      summary: `Invited ${email} as ${input.role.toLowerCase()}`,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return this.toInvitation(invitation);
  }

  // -------------------------------------------------------------------- read

  async listPending(context: FamilyContext): Promise<Invitation[]> {
    const rows = (await this.prisma.scoped.invitation.findMany({
      where: { familyId: context.familyId, acceptedAt: null, revokedAt: null },
      include: { invitedBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    })) as InvitationRow[];

    return rows.map((row) => this.toInvitation(row));
  }

  /**
   * What a link-holder sees before signing in.
   *
   * Not family-scoped, because the person holding the link is by definition not
   * yet a member. It discloses only the family's name, who invited them and the
   * role - enough to answer "what is this?" and nothing that would matter if the
   * link were forwarded.
   */
  async preview(token: string): Promise<InvitationPreview> {
    const row = (await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        invitedBy: { select: { name: true, email: true } },
        family: { select: { id: true, name: true, deletedAt: true } },
      },
    })) as InvitationRow | null;

    const notFound: InvitationPreview = {
      familyName: '',
      invitedByName: null,
      email: '',
      role: 'VIEWER',
      status: 'NOT_FOUND',
    };

    if (!row || !row.family || row.family.deletedAt || row.revokedAt) return notFound;

    const base = {
      familyName: row.family.name,
      invitedByName: row.invitedBy?.name ?? row.invitedBy?.email ?? null,
      email: row.email,
      role: row.role,
    };

    if (row.acceptedAt) return { ...base, status: 'ALREADY_ACCEPTED' as const };
    if (row.expiresAt.getTime() <= Date.now()) return { ...base, status: 'EXPIRED' as const };
    return { ...base, status: 'VALID' as const };
  }

  // ------------------------------------------------------------------ accept

  /**
   * Joins the family.
   *
   * The signed-in user's address must match the one invited.
   *
   * That is a deliberate restriction, and it costs something: a person who
   * signed up with a different address has to be re-invited. The alternative is
   * worse - an invitation forwarded into a group chat would let anyone who saw
   * it read a family's private history, and a link is forwarded far more often
   * than anyone expects.
   */
  async accept(
    token: string,
    user: { id: string; email: string },
    context: { ip?: string; userAgent?: string },
  ): Promise<AcceptInvitationResponse> {
    const row = (await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { family: { select: { id: true, name: true, deletedAt: true } } },
    })) as InvitationRow | null;

    if (!row || !row.family || row.family.deletedAt || row.revokedAt || row.acceptedAt) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'That invitation is no longer valid. Ask for a new one.',
      });
    }

    if (row.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'That invitation has expired. Ask for a new one.',
      });
    }

    if (row.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: `This invitation was sent to ${row.email}. Sign in with that address to accept it.`,
      });
    }

    const already = await this.prisma.familyMembership.findUnique({
      where: { userId_familyId: { userId: user.id, familyId: row.familyId } },
    });

    // Membership and consumption move together: a half-applied invitation
    // either locks someone out or leaves a reusable link.
    await this.prisma.$transaction([
      ...(already
        ? []
        : [
            this.prisma.familyMembership.create({
              data: {
                userId: user.id,
                familyId: row.familyId,
                role: row.role,
                invitedById: row.invitedById,
              },
            }),
          ]),
      this.prisma.invitation.update({
        where: { id: row.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    await this.audit.record({
      familyId: row.familyId,
      actorUserId: user.id,
      action: 'INVITATION_ACCEPTED',
      entityType: 'Invitation',
      entityId: row.id,
      summary: `${user.email} joined as ${row.role.toLowerCase()}`,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { familyId: row.familyId, familyName: row.family.name };
  }

  async revoke(context: FamilyContext, invitationId: string, actor: ActorContext): Promise<void> {
    const row = (await this.prisma.scoped.invitation.findFirst({
      where: { id: invitationId, familyId: context.familyId, acceptedAt: null },
    })) as InvitationRow | null;

    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'That invitation no longer exists.',
      });
    }

    await this.prisma.scoped.invitation.updateMany({
      where: { id: invitationId, familyId: context.familyId },
      data: { revokedAt: new Date() },
    });

    await this.audit.record({
      familyId: context.familyId,
      actorUserId: actor.userId,
      action: 'INVITATION_REVOKED',
      entityType: 'Invitation',
      entityId: invitationId,
      summary: `Cancelled the invitation to ${row.email}`,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  }

  // ----------------------------------------------------------------- helpers

  private toInvitation(row: InvitationRow): Invitation {
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      invitedByName: row.invitedBy?.name ?? row.invitedBy?.email ?? null,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      isExpired: row.expiresAt.getTime() <= Date.now(),
    };
  }
}