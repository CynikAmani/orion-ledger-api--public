import { Injectable } from '@nestjs/common';
import { UPLOAD_DIRS } from '../../../../../core/storage/constants/upload-dirs.constant';
import { ImageStorageService } from '../../../../../core/storage/services/image-storage.service';
import { PrismaService } from '../../../../../core/database/prisma.service';

export interface ReplaceTenantBrandLogoResult {
  logoImgName: string;
  previousLogoImgName: string | null;
}

@Injectable()
export class TenantBrandLogoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageStorage: ImageStorageService,
  ) {}

  async replaceLogo(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<ReplaceTenantBrandLogoResult> {
    const existing = await this.prisma.tenantBrandProfile.findUnique({
      where: { tenantId },
      select: { id: true, logoImgName: true },
    });
    const previousLogoImgName = existing?.logoImgName ?? null;
    const logoImgName = await this.imageStorage.save(
      file,
      `${UPLOAD_DIRS.BRAND_TENANT}/${tenantId}`,
    );

    try {
      await this.prisma.$transaction([
        this.prisma.tenantBrandProfile.upsert({
          where: { tenantId },
          create: { tenantId, logoImgName },
          update: { logoImgName },
          select: { id: true },
        }),
        this.prisma.tenant.update({
          where: { tenantId },
          data: { logoUrl: logoImgName },
          select: { tenantId: true },
        }),
      ]);
    } catch (error) {
      await this.imageStorage.deleteIfExists(logoImgName);
      throw error;
    }

    await this.imageStorage.deleteIfExists(previousLogoImgName);

    return { logoImgName, previousLogoImgName };
  }
}
