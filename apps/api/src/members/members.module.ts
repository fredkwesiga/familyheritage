import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  // FamiliesModule exports the two tenancy guards this controller mounts.
  imports: [FamiliesModule],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}