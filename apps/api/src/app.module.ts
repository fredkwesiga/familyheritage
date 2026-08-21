import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { EmailModule } from './email/email.module';
import { FamiliesModule } from './families/families.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { MembersModule } from './members/members.module';
import { RelationshipsModule } from './relationships/relationships.module';
import { PhotosModule } from './photos/photos.module';
import { StoriesModule } from './stories/stories.module';
import { InvitationsModule } from './invitations/invitations.module';
import { ExportModule } from './export/export.module';

/**
 * Root module.
 *
 * Two global guards, and the order matters: ThrottlerGuard runs first so that
 * a brute-force attempt is rejected before it costs an Argon2 hash. Nest runs
 * APP_GUARD providers in declaration order.
 *
 * The two tenancy guards - FamilyMembershipGuard and PermissionGuard - are
 * deliberately NOT global. They need a :familyId route parameter, so they are
 * mounted per-controller on family-scoped routes.
 *
 * Feature modules still to come:
 *   Phase 5  members       Phase 6  relationships   Phase 12 stories
 *   Phase 14 invitations   Phase 16 ai
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    EmailModule,
    AuditModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    AuthModule,
    FamiliesModule,
    MembersModule,
    RelationshipsModule,
    PhotosModule,
    StoriesModule,
    InvitationsModule,
    HealthModule,
    InvitationsModule,
    ExportModule,

  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule { }