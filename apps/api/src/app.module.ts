import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { EmailModule } from './email/email.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Root module.
 *
 * Two global guards, and the order matters: ThrottlerGuard runs first so that
 * a brute-force attempt is rejected before it costs an Argon2 hash. Nest runs
 * APP_GUARD providers in declaration order.
 *
 * Feature modules still to come:
 *   Phase 4  families      Phase 5  members       Phase 6  relationships
 *   Phase 12 stories       Phase 14 invitations   Phase 16 ai
 *   Phase 17 audit
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    EmailModule,
    // In-memory storage: correct for a single free-tier instance. Phase 20 adds
    // a shared store only if we ever run more than one.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    AuthModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}