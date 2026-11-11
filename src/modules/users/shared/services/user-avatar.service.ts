import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { UserAccountLifecycleValidator } from '../validators/user-account-lifecycle.validator';
import { AvatarStorageService } from './avatar-storage.service';

export interface ReplaceUserAvatarResult {
  avatarUrl: string;
  previousAvatarUrl: string | null;
}

/**
 * Coordinates avatar file storage with the user record.
 *
 * Database writes use a minimal select and return no relations. A separate
 * read loads the full profile afterward. This avoids concurrent queries on a
 * single pg client inside Prisma write transactions (@prisma/adapter-pg).
 */
@Injectable()
export class UserAvatarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avatarStorage: AvatarStorageService,
    private readonly userAccountLifecycleValidator: UserAccountLifecycleValidator,
  ) {}

  async replaceAvatar(
    id: number,
    file: Express.Multer.File,
  ): Promise<ReplaceUserAvatarResult> {
    const lifecycleUser =
      await this.userAccountLifecycleValidator.assertUserAccountIsNotDeletedById(
        id,
      );
    const previousAvatarUrl = lifecycleUser.avatarUrl ?? null;

    const avatarUrl = await this.avatarStorage.save(file);

    try {
      await this.prisma.user.update({
        where: { id },
        data: { avatarUrl },
        select: { userId: true },
      });
    } catch (error) {
      await this.avatarStorage.deleteIfExists(avatarUrl);
      throw error;
    }

    await this.avatarStorage.deleteIfExists(previousAvatarUrl);

    return { avatarUrl, previousAvatarUrl };
  }
}
