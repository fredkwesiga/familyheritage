import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCode, type SessionUser } from '@fh/shared';
import type { Env } from '../config/env.schema';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthTokenService } from './auth-token.service';
import type { AuthenticatedUser } from './auth.types';
import { PasswordService } from './password.service';
import { SessionService, type IssuedSession } from './session.service';

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly tokens: AuthTokenService,
    private readonly email: EmailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ---------------------------------------------------------------- register

  async register(
    input: { email: string; password: string; name?: string },
    context: RequestContext,
  ): Promise<{ user: SessionUser; session: IssuedSession }> {
    const email = input.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Registration is the one place we cannot avoid revealing that an address
      // is taken - the user has to be told why they cannot proceed. The
      // mitigation is rate limiting on this route, not a vague message that
      // would leave a legitimate user stuck.
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'An account with that email already exists. Try signing in instead.',
      });
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name: input.name?.trim() || null,
        passwordHash: await this.passwords.hash(input.password),
      },
    });

    const session = await this.sessions.issue(user.id, context);

    // Verification is sent but not enforced: blocking a brand-new user at the
    // door is how you lose them before they have added a single relative.
    // Phase 14 gates invitations on a verified address instead.
    await this.sendVerificationEmail(user.id, email).catch((error: unknown) => {
      this.logger.warn(`Could not send verification email: ${String(error)}`);
    });

    return { user: await this.buildSessionUser(user.id), session };
  }

  // ------------------------------------------------------------------- login

  async login(
    input: { email: string; password: string },
    context: RequestContext,
  ): Promise<{ user: SessionUser; session: IssuedSession }> {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // One error for "no such account", "wrong password" and "deleted account".
    // Anything more specific is an account-existence oracle.
    const passwordMatches = await this.passwords.verify(user?.passwordHash ?? null, input.password);

    if (!user || user.deletedAt || !passwordMatches) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHENTICATED,
        message: 'That email or password is not correct.',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const session = await this.sessions.issue(user.id, context);
    return { user: await this.buildSessionUser(user.id), session };
  }

  // -------------------------------------------------------------- magic link

  /**
   * Always resolves, whether or not the address exists.
   *
   * A meaningful share of this product's users are older relatives who will not
   * successfully manage a password. Passwordless sign-in is not a convenience
   * feature here - it is what keeps them contributing.
   */
  async requestMagicLink(rawEmail: string): Promise<void> {
    const email = rawEmail.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || user.deletedAt) {
      this.logger.log(`Magic link requested for unknown address (no email sent)`);
      return;
    }

    const { token } = await this.tokens.issue(email, 'MAGIC_LINK', user.id);
    await this.email.sendMagicLink(email, this.buildUrl('/auth/magic-link', token));
  }

  async verifyMagicLink(
    token: string,
    context: RequestContext,
  ): Promise<{ user: SessionUser; session: IssuedSession }> {
    const consumed = await this.tokens.consume(token, 'MAGIC_LINK');
    if (!consumed?.userId) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHENTICATED,
        message: 'That sign-in link is invalid or has expired. Request a new one.',
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: consumed.userId } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHENTICATED,
        message: 'That sign-in link is invalid or has expired. Request a new one.',
      });
    }

    // Clicking a link sent to an address proves control of it.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
    });

    const session = await this.sessions.issue(user.id, context);
    return { user: await this.buildSessionUser(user.id), session };
  }

  // ---------------------------------------------------------- password reset

  async requestPasswordReset(rawEmail: string): Promise<void> {
    const email = rawEmail.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || user.deletedAt) return;

    const { token } = await this.tokens.issue(email, 'PASSWORD_RESET', user.id);
    await this.email.sendPasswordReset(email, this.buildUrl('/auth/reset-password', token));
  }

  async confirmPasswordReset(token: string, password: string): Promise<void> {
    const consumed = await this.tokens.consume(token, 'PASSWORD_RESET');
    if (!consumed?.userId) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHENTICATED,
        message: 'That reset link is invalid or has expired. Request a new one.',
      });
    }

    await this.prisma.user.update({
      where: { id: consumed.userId },
      data: {
        passwordHash: await this.passwords.hash(password),
        emailVerifiedAt: new Date(),
      },
    });

    // If someone else knew the old password, a reset that leaves their session
    // alive has not recovered the account.
    const revoked = await this.sessions.revokeAllForUser(consumed.userId);
    this.logger.log(`Password reset completed; revoked ${revoked} session(s)`);
  }

  // -------------------------------------------------------- email verification

  async verifyEmail(token: string): Promise<void> {
    const consumed = await this.tokens.consume(token, 'EMAIL_VERIFICATION');
    if (!consumed?.userId) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHENTICATED,
        message: 'That verification link is invalid or has expired.',
      });
    }
    await this.prisma.user.update({
      where: { id: consumed.userId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  private async sendVerificationEmail(userId: string, email: string): Promise<void> {
    const { token } = await this.tokens.issue(email, 'EMAIL_VERIFICATION', userId);
    await this.email.sendMagicLink(email, this.buildUrl('/auth/verify-email', token));
  }

  // -------------------------------------------------------------------- misc

  toSessionUser(user: AuthenticatedUser): SessionUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      families: user.families,
    };
  }

  private async buildSessionUser(userId: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        memberships: {
          include: { family: { select: { id: true, name: true, deletedAt: true } } },
        },
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerifiedAt !== null,
      families: user.memberships
        .filter((membership) => membership.family.deletedAt === null)
        .map((membership) => ({
          familyId: membership.familyId,
          name: membership.family.name,
          role: membership.role,
          claimedMemberId: membership.claimedMemberId,
        })),
    };
  }

  private buildUrl(path: string, token: string): string {
    const base = this.config.get('APP_URL', { infer: true }).replace(/\/$/, '');
    return `${base}${path}?token=${encodeURIComponent(token)}`;
  }
}