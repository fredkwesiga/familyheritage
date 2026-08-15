import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthTokenPurpose } from '@prisma/client';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';
import { generateToken, hashToken } from './token.util';

export interface IssuedAuthToken {
  token: string;
  expiresAt: Date;
}

export interface ConsumedAuthToken {
  userId: string | null;
  email: string;
}

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Issues a single-use token and invalidates any earlier unconsumed token for
   * the same address and purpose. Without that, every "resend the link" click
   * leaves another live token in circulation.
   */
  async issue(
    email: string,
    purpose: AuthTokenPurpose,
    userId: string | null,
  ): Promise<IssuedAuthToken> {
    const minutes = this.config.get('AUTH_TOKEN_TTL_MINUTES', { infer: true });
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
    const token = generateToken();

    await this.prisma.$transaction([
      this.prisma.authToken.deleteMany({ where: { email, purpose, consumedAt: null } }),
      this.prisma.authToken.create({
        data: { email, purpose, userId, tokenHash: hashToken(token), expiresAt },
      }),
    ]);

    return { token, expiresAt };
  }

  /**
   * Consumes a token atomically. Returns null if it is unknown, already used,
   * expired, or issued for a different purpose.
   *
   * The updateMany-with-guard pattern is what makes this single-use even under
   * a double-click: only one caller can transition consumedAt from null.
   */
  async consume(token: string, purpose: AuthTokenPurpose): Promise<ConsumedAuthToken | null> {
    const tokenHash = hashToken(token);

    const { count } = await this.prisma.authToken.updateMany({
      where: { tokenHash, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });

    if (count === 0) return null;

    const record = await this.prisma.authToken.findUnique({ where: { tokenHash } });
    if (!record) return null;

    return { userId: record.userId, email: record.email };
  }

  async purgeExpired(): Promise<number> {
    const { count } = await this.prisma.authToken.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    return count;
  }
}