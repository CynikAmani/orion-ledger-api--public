import { Injectable } from '@nestjs/common';
import type { AuditContext } from '../../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../../core/database/prisma.service';
import type { BrandAboutFields } from '../../../shared/interfaces/brand-about.interface';
import { TENANT_BRAND_ABOUT_AUDIT_ACTIONS } from '../constants/tenant-brand-about-audit-actions.constant';
import { UpdateTenantBrandAboutDto } from '../dto/update-tenant-brand-about.dto';

const TENANT_BRAND_ABOUT_SELECT = {
  brandMission: true,
  brandVision: true,
  contactPhone: true,
  whatsappPhone: true,
  contactEmail: true,
  coreValues: true,
} as const;

export interface TenantBrandAboutResponse extends BrandAboutFields {}

export interface UpdateTenantBrandAboutResponse {
  success: true;
  brandMission: string | null;
  brandVision: string | null;
  contactPhone: string | null;
  whatsappPhone: string | null;
  contactEmail: string | null;
  coreValues: string | null;
}

@Injectable()
export class TenantBrandAboutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
  ) {}

  async getAboutDetails(tenantId: string): Promise<TenantBrandAboutResponse> {
    const profile = await this.prisma.tenantBrandProfile.findUnique({
      where: { tenantId },
      select: TENANT_BRAND_ABOUT_SELECT,
    });

    return {
      brandMission: profile?.brandMission ?? null,
      brandVision: profile?.brandVision ?? null,
      contactPhone: profile?.contactPhone ?? null,
      whatsappPhone: profile?.whatsappPhone ?? null,
      contactEmail: profile?.contactEmail ?? null,
      coreValues: profile?.coreValues ?? null,
    };
  }

  async updateAboutDetails(
    tenantId: string,
    dto: UpdateTenantBrandAboutDto,
    auditContext: AuditContext,
  ): Promise<UpdateTenantBrandAboutResponse> {
    const existing = await this.prisma.tenantBrandProfile.findUnique({
      where: { tenantId },
      select: { id: true },
    });

    const profile = await this.prisma.tenantBrandProfile.upsert({
      where: { tenantId },
      create: { tenantId, ...dto },
      update: dto,
      select: { id: true, ...TENANT_BRAND_ABOUT_SELECT },
    });

    this.auditEmitter.emit({
      ...auditContext,
      tenantId,
      module: 'TENANT',
      targetType: 'TenantBrandProfile',
      action: existing
        ? TENANT_BRAND_ABOUT_AUDIT_ACTIONS.UPDATED
        : TENANT_BRAND_ABOUT_AUDIT_ACTIONS.CREATED,
      targetId: String(profile.id),
      payload: { ...dto },
    });

    return {
      success: true,
      brandMission: profile.brandMission,
      brandVision: profile.brandVision,
      contactPhone: profile.contactPhone,
      whatsappPhone: profile.whatsappPhone,
      contactEmail: profile.contactEmail,
      coreValues: profile.coreValues,
    };
  }
}
