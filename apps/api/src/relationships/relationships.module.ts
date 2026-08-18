import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { MembersModule } from '../members/members.module';
import { GraphRepository } from './graph.repository';
import { RelationshipGraphLoader } from './relationship-graph.loader';
import { RelationshipsController } from './relationships.controller';
import { RelationshipsService } from './relationships.service';

@Module({
  imports: [FamiliesModule, MembersModule],
  controllers: [RelationshipsController],
  providers: [RelationshipsService, GraphRepository, RelationshipGraphLoader],
  // GraphRepository is exported because Phase 7's relationship engine builds
  // its traversal on exactly these primitives.
  exports: [RelationshipsService, GraphRepository, RelationshipGraphLoader],
})
export class RelationshipsModule {}