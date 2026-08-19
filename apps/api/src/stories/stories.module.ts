import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';

@Module({
  imports: [FamiliesModule],
  controllers: [StoriesController],
  providers: [StoriesService],
  // Exported because the AI story assistant in Phase 16 creates drafts through
  // this service rather than writing rows of its own.
  exports: [StoriesService],
})
export class StoriesModule {}