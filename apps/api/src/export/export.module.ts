import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { PhotosModule } from '../photos/photos.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [FamiliesModule, PhotosModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}