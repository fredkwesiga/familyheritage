import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * The single Prisma connection for the process.
 *
 * Every module that touches the database injects this service. Repositories in
 * later phases wrap it - controllers never see it. From Phase 4 this class also
 * becomes the place where family-scope enforcement lives (a Prisma client
 * extension that rejects any query on a tenant-scoped model without a familyId
 * filter), which is why it is a service and not a bare exported client.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

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
