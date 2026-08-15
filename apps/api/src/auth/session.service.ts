import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from './auth.types';
import { generateToken, hashToken } from './token.util';

/** Only rewrite lastUsedAt when it is this stale - avoids a write per request. */
const LAST_USED_WRITE_THRESHOLD_MS = 60 * 60 * 1000;

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

export interface ResolvedSession {
  sessionId: string;
  user: AuthenticatedUser;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async issue(
    userId: string,
    context: { ip?: string; userAgent?: string } = {},
  ): Promise<IssuedSession> {
    const token = generateToken();
    const ttlDays = this.config.get('SESSION_TTL_DAYS', { infer: true });
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt,
        ip: context.ip ?? null,
        userAgent: context.userAgent?.slice(0, 500) ?? null,
      },
    });

    return { token, expiresAt };
  }

  /**
   * Resolves a raw cookie token to a user, or null.
   *
   * Returns null for every failure mode - unknown token, expired session,
   * deleted user - because the caller only ever needs "authenticated or not".
   */
  async resolve(token: string): Promise<ResolvedSession | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        user: {
          include: {
            memberships: {
              include: { family: { select: { id: true, name: true, deletedAt: true } } },
            },
          },
        },
      },
    });

    if (!session) return null;

    if (session.expiresAt.getTime() <= Date.now()) {
      // Opportunistic cleanup: the row is worthless now.
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }

    if (session.user.deletedAt) return null;

    if (Date.now() - session.lastUsedAt.getTime() > LAST_USED_WRITE_THRESHOLD_MS) {
      await this.prisma.session
        .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);
    }

    return {
      sessionId: session.id,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        avatarUrl: session.user.avatarUrl,
        emailVerified: session.user.emailVerifiedAt !== null,
        families: session.user.memberships
          .filter((membership) => membership.family.deletedAt === null)
          .map((membership) => ({
            familyId: membership.familyId,
            name: membership.family.name,
            role: membership.role,
            claimedMemberId: membership.claimedMemberId,
          })),
      },
    };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }

  /**
   * Used after a password change or reset. If someone else knew the old
   * password, changing it has to end their sessions too - otherwise the
   * "recover my account" flow does not actually recover the account.
   */
  async revokeAllForUser(userId: string): Promise<number> {
    const { count } = await this.prisma.session.deleteMany({ where: { userId } });
    return count;
  }

  /** Called on a schedule from Phase 20. Safe to run at any time. */
  async purgeExpired(): Promise<number> {
    const { count } = await this.prisma.session.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    if (count > 0) this.logger.log(`Purged ${count} expired session(s)`);
    return count;
  }
}