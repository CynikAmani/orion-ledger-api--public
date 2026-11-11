import { Injectable } from '@nestjs/common';
import { UPLOAD_DIRS } from '../../../../../core/storage/constants/upload-dirs.constant';
import { ImageStorageService } from '../../../../../core/storage/services/image-storage.service';
import { PrismaService } from '../../../../../core/database/prisma.service';

export interface ReplaceBrandLogoResult {
  logoImgName: string;
  previousLogoImgName: string | null;
}

@Injectable()
export class BrandLogoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageStorage: ImageStorageService,
  ) {}

  async replaceLogo(file: Express.Multer.File): Promise<ReplaceBrandLogoResult> {
    const existing = await this.prisma.brandDetail.findFirst({
      select: { id: true, logoImgName: true },
    });
    const previousLogoImgName = existing?.logoImgName ?? null;
    const logoImgName = await this.imageStorage.save(file, UPLOAD_DIRS.BRAND);

    try {
      if (existing) {
        await this.prisma.brandDetail.update({
          where: { id: existing.id },
          data: { logoImgName },
          select: { id: true },
        });
      } else {
        await this.prisma.brandDetail.create({
          data: { logoImgName },
          select: { id: true },
        });
      }
    } catch (error) {
      await this.imageStorage.deleteIfExists(logoImgName);
      throw error;
    }

    await this.imageStorage.deleteIfExists(previousLogoImgName);

    return { logoImgName, previousLogoImgName };
  }
}
