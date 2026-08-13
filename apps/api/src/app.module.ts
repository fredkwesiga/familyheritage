import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';

/**
 * Root module.
 *
 * Feature modules are added here one phase at a time and stay independent:
 *   Phase 3  auth
 *   Phase 4  families
 *   Phase 5  members
 *   Phase 6  relationships
 *   Phase 12 stories        Phase 14 invitations
 *   Phase 16 ai             Phase 17 audit
 */
@Module({
  imports: [ConfigModule, PrismaModule, HealthModule],
})
export class AppModule {}
