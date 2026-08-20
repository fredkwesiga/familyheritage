import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { MemberSearchRepository } from './member-search.repository';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  // FamiliesModule exports the two tenancy guards this controller mounts.
  imports: [FamiliesModule],
  controllers: [MembersController],
  providers: [MembersService, MemberSearchRepository],
  exports: [MembersService],
})
export class MembersModule {}