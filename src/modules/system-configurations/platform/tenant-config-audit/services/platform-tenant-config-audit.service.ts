import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AgreementStatus,
  AgreementType,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../../../../core/database/prisma.service';
import type { BrandAboutFields } from '../../../shared/interfaces/brand-about.interface';
import type { BrandIdentityFields } from '../../../shared/interfaces/brand-identity.interface';

const TENANT_CONFIG_AUDIT_SELECT = {
  tenantId: true,
  tenantCode: true,
  slug: true,
  name: true,
  logoUrl: true,
  brandColor: true,
  isActive: true,
  subscriptionStatus: true,
  paymentStatus: true,
  trialEndsAt: true,
  createdAt: true,
  updatedAt: true,
  brandProfile: {
    select: {
      brandName: true,
      slogan: true,
      logoImgName: true,
      brandMission: true,
      brandVision: true,
      contactPhone: true,
      whatsappPhone: true,
      contactEmail: true,
      coreValues: true,
    },
  },
  termsAndConditions: {
    select: {
      id: true,
      version: true,
      title: true,
      content: true,
      type: true,
      status: true,
      effectiveDate: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ effectiveDate: 'desc' as const }, { id: 'desc' as const }],
  },
} satisfies Prisma.TenantSelect;

export interface PlatformTenantConfigBrand
  extends BrandIdentityFields {
  logoImgName: string | null;
}

export interface PlatformTenantConfigAgreement {
  id: number;
  version: string;
  title: string;
  content: string;
  type: AgreementType;
  status: AgreementStatus;
  effectiveDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformTenantConfigAuditResponse {
  tenant: {
    uuid: string;
    tenantCode: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    brandColor: string | null;
    isActive: boolean;
    subscriptionStatus: SubscriptionStatus;
    paymentStatus: PaymentStatus;
    trialEndsAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  brand: PlatformTenantConfigBrand;
  about: BrandAboutFields;
  termsAndConditions: PlatformTenantConfigAgreement[];
}

@Injectable()
export class PlatformTenantConfigAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async getByTenantUuid(
    uuid: string,
  ): Promise<PlatformTenantConfigAuditResponse> {
    const trimmed = uuid.trim();
    if (trimmed.length === 0) {
      throw new NotFoundException('Tenant not found');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { tenantId: trimmed },
      select: TENANT_CONFIG_AUDIT_SELECT,
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const profile = tenant.brandProfile;

    return {
      tenant: {
        uuid: tenant.tenantId,
        tenantCode: tenant.tenantCode,
        slug: tenant.slug,
        name: tenant.name,
        logoUrl: tenant.logoUrl,
        brandColor: tenant.brandColor,
        isActive: tenant.isActive,
        subscriptionStatus: tenant.subscriptionStatus,
        paymentStatus: tenant.paymentStatus,
        trialEndsAt: tenant.trialEndsAt,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
      },
      brand: {
        brandName: profile?.brandName ?? null,
        slogan: profile?.slogan ?? null,
        logoImgName: profile?.logoImgName ?? null,
      },
      about: {
        brandMission: profile?.brandMission ?? null,
        brandVision: profile?.brandVision ?? null,
        contactPhone: profile?.contactPhone ?? null,
        whatsappPhone: profile?.whatsappPhone ?? null,
        contactEmail: profile?.contactEmail ?? null,
        coreValues: profile?.coreValues ?? null,
      },
      termsAndConditions: tenant.termsAndConditions,
    };
  }
}
