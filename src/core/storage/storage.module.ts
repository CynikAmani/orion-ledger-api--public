import { Global, Module } from '@nestjs/common';
import { ImageStorageService } from './services/image-storage.service';

@Global()
@Module({
  providers: [ImageStorageService],
  exports: [ImageStorageService],
})
export class StorageModule {}
