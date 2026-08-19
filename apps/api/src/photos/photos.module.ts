import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { CloudinaryProvider } from './cloudinary.provider';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { STORAGE_PROVIDER } from './storage.provider';

@Module({
  imports: [FamiliesModule],
  controllers: [PhotosController],
  providers: [
    PhotosService,
    // Bound through a token rather than the class, so swapping Cloudinary for
    // R2 or S3 later is one line here and a new file - nothing else moves.
    { provide: STORAGE_PROVIDER, useClass: CloudinaryProvider },
  ],
  exports: [PhotosService],
})
export class PhotosModule {}