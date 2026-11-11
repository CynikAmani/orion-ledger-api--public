import { Injectable } from '@nestjs/common';
import type { AuditContext } from '../../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../../core/database/prisma.service';
import { TenantLoanApplicationEligibilityService } from '../../../../tenants/shared/services/tenant-loan-application-eligibility.service';
import { resolveTenantLogoUrl } from '../../../../tenants/shared/utils/resolve-tenant-logo-url.util';
import type { BrandIdentityFields } from '../../../shared/interfaces/brand-identity.interface';
import { TENANT_BRAND_AUDIT_ACTIONS } from '../constants/tenant-brand-audit-actions.constant';
import { UpdateTenantBrandDetailsDto } from '../dto/update-tenant-brand-details.dto';
import { TenantBrandLogoService } from './tenant-brand-logo.service';

const TENANT_BRAND_IDENTITY_SELECT = {
  brandName: true,
  slogan: true,
  logoImgName: true,
} as const;

export interface TenantBrandDetailsResponse extends BrandIdentityFields {
  logoImgName: string | null;
  logoUrl: string | null;
  brandColor: string | null;
}

export interface UpdateTenantBrandDetailsResponse {
  success: true;
  brandName: string | null;
  slogan: string | null;
  logoImgName: string | null;
  logoUrl: string | null;
  brandColor: string | null;
}

@Injectable()
export class TenantBrandDetailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantBrandLogoService: TenantBrandLogoService,
    private readonly auditEmitter: AuditEmitterService,
    private readonly eligibility: TenantLoanApplicationEligibilityService,
  ) {}

  async getBrandDetails(tenantId: string): Promise<TenantBrandDetailsResponse> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { tenantId },
      select: {
        brandColor: true,
        logoUrl: true,
        brandProfile: { select: TENANT_BRAND_IDENTITY_SELECT },
      },
    });

    return this.toDetailsResponse(
      tenant?.brandProfile ?? null,
      tenant?.brandColor ?? null,
      tenant?.logoUrl ?? null,
    );
  }

  async updateBrandDetails(
    tenantId: string,
    dto: UpdateTenantBrandDetailsDto,
    auditContext: AuditContext,
  ): Promise<UpdateTenantBrandDetailsResponse> {
    const { brandColor, ...identity } = dto;

    const existing = await this.prisma.tenantBrandProfile.findUnique({
      where: { tenantId },
      select: { id: true },
    });

    const { profile, tenant } = await this.prisma.$transaction(async (tx) => {
      const profile = await tx.tenantBrandProfile.upsert({
        where: { tenantId },
        create: { tenantId, ...identity },
        update: identity,
        select: { id: true, ...TENANT_BRAND_IDENTITY_SELECT },
      });

      const tenant =
        brandColor === undefined
          ? await tx.tenant.findUniqueOrThrow({
              where: { tenantId },
              select: { brandColor: true, logoUrl: true },
            })
          : await tx.tenant.update({
              where: { tenantId },
              data: { brandColor },
              select: { brandColor: true, logoUrl: true },
            });

      return { profile, tenant };
    });

    this.auditEmitter.emit({
      ...auditContext,
      tenantId,
      module: 'TENANT',
      targetType: 'TenantBrandProfile',
      action: existing
        ? TENANT_BRAND_AUDIT_ACTIONS.DETAILS_UPDATED
        : TENANT_BRAND_AUDIT_ACTIONS.DETAILS_CREATED,
      targetId: String(profile.id),
      payload: { ...dto },
    });

    await this.eligibility.refresh(tenantId);

    return this.toUpdateResponse(profile, tenant.brandColor, tenant.logoUrl);
  }

  async updateLogo(
    tenantId: string,
    file: Express.Multer.File,
    auditContext: AuditContext,
  ): Promise<UpdateTenantBrandDetailsResponse> {
    await this.tenantBrandLogoService.replaceLogo(tenantId, file);

    const tenant = await this.prisma.tenant.findUnique({
      where: { tenantId },
      select: {
        brandColor: true,
        logoUrl: true,
        brandProfile: {
          select: { id: true, ...TENANT_BRAND_IDENTITY_SELECT },
        },
      },
    });

    this.auditEmitter.emit({
      ...auditContext,
      tenantId,
      module: 'TENANT',
      targetType: 'TenantBrandProfile',
      action: TENANT_BRAND_AUDIT_ACTIONS.LOGO_UPDATED,
      targetId: tenant?.brandProfile
        ? String(tenant.brandProfile.id)
        : 'tenant-brand-logo',
      payload: {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        logoImgName: tenant?.brandProfile?.logoImgName ?? null,
      },
    });

    await this.eligibility.refresh(tenantId);

    return this.toUpdateResponse(
      tenant?.brandProfile ?? null,
      tenant?.brandColor ?? null,
      tenant?.logoUrl ?? null,
    );
  }

  private toDetailsResponse(
    profile: {
      brandName: string | null;
      slogan: string | null;
      logoImgName: string | null;
    } | null,
    brandColor: string | null,
    storedLogoUrl: string | null,
  ): TenantBrandDetailsResponse {
    const logoImgName = profile?.logoImgName ?? null;

    return {
      brandName: profile?.brandName ?? null,
      slogan: profile?.slogan ?? null,
      logoImgName,
      logoUrl: resolveTenantLogoUrl({
        logoUrl: storedLogoUrl,
        logoImgName,
      }),
      brandColor,
    };
  }

  private toUpdateResponse(
    profile: {
      brandName: string | null;
      slogan: string | null;
      logoImgName: string | null;
    } | null,
    brandColor: string | null,
    storedLogoUrl: string | null,
  ): UpdateTenantBrandDetailsResponse {
    return {
      success: true,
      ...this.toDetailsResponse(profile, brandColor, storedLogoUrl),
    };
  }
}
