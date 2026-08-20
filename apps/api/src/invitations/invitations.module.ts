import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { InvitationAccessController } from './invitation-access.controller';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [FamiliesModule],
  controllers: [InvitationsController, InvitationAccessController],
  providers: [InvitationsService],
})
export class InvitationsModule {}