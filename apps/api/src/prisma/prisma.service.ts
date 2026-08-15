import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantGuardExtension } from './tenant-guard.extension';

/**
 * Two clients, deliberately.
 *
 * `this` is the plain client, used by code that operates outside any family:
 * users, sessions, auth tokens, and creating a family in the first place.
 *
 * `this.scoped` carries the tenant guard and MUST be used for every model that
 * belongs to a family. If a query on one of those models arrives without a
 * familyId filter, it throws instead of silently returning another family's
 * rows.
 *
 * Keeping them separate rather than extending `this` in place avoids proxying
 * the class, keeps types honest, and makes "which client am I using and why"
 * a visible decision at every call site.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /** Family-scoped client. Use this for Member, Story, Photo, and friends. */
  readonly scoped = this.$extends(tenantGuardExtension);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Disconnected from PostgreSQL');
  }

  /** Cheap liveness probe used by the health endpoint. */
  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}