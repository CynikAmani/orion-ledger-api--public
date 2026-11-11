import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../../core/database/prisma.service';
import type { BrandAboutFields } from '../../../shared/interfaces/brand-about.interface';
import type { BrandIdentityFields } from '../../../shared/interfaces/brand-identity.interface';
import type { TenantPublicAgreementsResponse } from '../../tenant-terms-and-conditions/services/tenant-terms-and-conditions.service';
import { TenantTermsAndConditionsService } from '../../tenant-terms-and-conditions/services/tenant-terms-and-conditions.service';

const PUBLIC_TENANT_PROFILE_SELECT = {
  tenantId: true,
  slug: true,
  name: true,
  brandColor: true,
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
} as const;

export interface PublicTenantBrandIdentity extends BrandIdentityFields {
  logoImgName: string | null;
}

export interface PublicTenantProfileResponse {
  slug: string;
  name: string;
  brandColor: string | null;
  brand: PublicTenantBrandIdentity;
  about: BrandAboutFields;
  termsAndConditions: TenantPublicAgreementsResponse;
}

@Injectable()
export class PublicTenantProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantTermsAndConditionsService: TenantTermsAndConditionsService,
  ) {}

  async getProfileBySlug(slug: string): Promise<PublicTenantProfileResponse> {
    const trimmed = slug.trim();

    if (trimmed.length === 0) {
      throw new NotFoundException('Tenant not found');
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: {
        isActive: true,
        OR: [{ slug: trimmed }, { slug: trimmed.toLowerCase() }],
      },
      select: PUBLIC_TENANT_PROFILE_SELECT,
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const profile = tenant.brandProfile;
    const termsAndConditions =
      await this.tenantTermsAndConditionsService.findPublic(tenant.tenantId);

    return {
      slug: tenant.slug,
      name: tenant.name,
      brandColor: tenant.brandColor,
      brand: {
        brandName: profile?.brandName ?? tenant.name,
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
      termsAndConditions,
    };
  }
}
