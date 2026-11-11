import { Injectable } from '@nestjs/common';
import { UPLOAD_DIRS } from '../../../../core/storage/constants/upload-dirs.constant';
import { ImageStorageService } from '../../../../core/storage/services/image-storage.service';

/**
 * Thin domain facade over {@link ImageStorageService} for user avatars.
 * Prefer composition over a second storage implementation.
 */
@Injectable()
export class AvatarStorageService {
  constructor(private readonly imageStorage: ImageStorageService) {}

  save(file: Express.Multer.File): Promise<string> {
    return this.imageStorage.save(file, UPLOAD_DIRS.AVATARS);
  }

  deleteIfExists(relativePath: string | null | undefined): Promise<void> {
    return this.imageStorage.deleteIfExists(relativePath);
  }
}
