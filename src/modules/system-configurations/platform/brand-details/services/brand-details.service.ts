import { Injectable } from '@nestjs/common';
import type { AuditContext } from '../../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../../core/database/prisma.service';
import { UpdateBrandDetailsDto } from '../dto/update-brand-details.dto';
import { BrandLogoService } from './brand-logo.service';

const BRAND_DETAILS_SELECT = {
  brandName: true,
  slogan: true,
  logoImgName: true,
} as const;

export interface BrandDetailsResponse {
  brandName: string | null;
  slogan: string | null;
  logoImgName: string | null;
}

export interface UpdateBrandDetailsResponse {
  success: true;
  brandName: string | null;
  slogan: string | null;
  logoImgName: string | null;
}

@Injectable()
export class BrandDetailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brandLogoService: BrandLogoService,
    private readonly auditEmitter: AuditEmitterService,
  ) {}

  async getBrandDetails(): Promise<BrandDetailsResponse> {
    const brand = await this.prisma.brandDetail.findFirst({
      select: BRAND_DETAILS_SELECT,
    });

    return {
      brandName: brand?.brandName ?? null,
      slogan: brand?.slogan ?? null,
      logoImgName: brand?.logoImgName ?? null,
    };
  }

  async updateBrandDetails(
    dto: UpdateBrandDetailsDto,
    auditContext: AuditContext,
  ): Promise<UpdateBrandDetailsResponse> {
    const existing = await this.prisma.brandDetail.findFirst({
      select: { id: true },
    });

    const brand = existing
      ? await this.prisma.brandDetail.update({
          where: { id: existing.id },
          data: dto,
          select: { id: true, ...BRAND_DETAILS_SELECT },
        })
      : await this.prisma.brandDetail.create({
          data: dto,
          select: { id: true, ...BRAND_DETAILS_SELECT },
        });

    this.emitAudit(auditContext, {
      action: existing ? 'BRAND_DETAILS_UPDATED' : 'BRAND_DETAILS_CREATED',
      targetId: String(brand.id),
      payload: { ...dto },
    });

    return {
      success: true,
      brandName: brand.brandName,
      slogan: brand.slogan,
      logoImgName: brand.logoImgName,
    };
  }

  async updateLogo(
    file: Express.Multer.File,
    auditContext: AuditContext,
  ): Promise<UpdateBrandDetailsResponse> {
    await this.brandLogoService.replaceLogo(file);

    const existing = await this.prisma.brandDetail.findFirst({
      select: { id: true, ...BRAND_DETAILS_SELECT },
    });

    this.emitAudit(auditContext, {
      action: 'BRAND_LOGO_UPDATED',
      targetId: existing ? String(existing.id) : 'brand-logo',
      payload: {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        logoImgName: existing?.logoImgName ?? null,
      },
    });

    return {
      success: true,
      brandName: existing?.brandName ?? null,
      slogan: existing?.slogan ?? null,
      logoImgName: existing?.logoImgName ?? null,
    };
  }

  private emitAudit(
    auditContext: AuditContext,
    params: { action: string; targetId: string; payload?: Record<string, unknown> },
  ): void {
    this.auditEmitter.emit({
      ...auditContext,
      module: 'SYSTEM_CONFIGURATIONS',
      targetType: 'BrandDetails',
      ...params,
    });
  }
}
