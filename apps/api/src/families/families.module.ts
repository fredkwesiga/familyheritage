import { Module } from '@nestjs/common';
import { FamiliesController } from './families.controller';
import { FamiliesService } from './families.service';
import { FamilyMembershipGuard } from './family-membership.guard';
import { PermissionGuard } from './permission.guard';

@Module({
  controllers: [FamiliesController],
  providers: [FamiliesService, FamilyMembershipGuard, PermissionGuard],
  // Exported because every feature module from Phase 5 onward mounts these two
  // guards on its own family-scoped routes.
  exports: [FamilyMembershipGuard, PermissionGuard],
})
export class FamiliesModule {}