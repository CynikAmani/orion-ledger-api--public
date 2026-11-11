import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AgreementStatus,
  AgreementType,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../../../core/database/prisma.service';
import type { AuthenticatedUser } from '../../../auth/shared/types/authenticated-user.type';
import { CustomerFavoritesService } from '../../../customers/favorites/services/customer-favorites.service';
import type { BrandAboutFields } from '../../../system-configurations/shared/interfaces/brand-about.interface';
import { IncludeDemoTenantsSettingsService } from '../../../system-configurations/platform/include-demo-tenants/services/include-demo-tenants-settings.service';
import {
  applicantActiveTenantWhere,
  TenantService,
} from '../../shared/services/tenant.service';
import { TenantLoanApplicationEligibilityService } from '../../shared/services/tenant-loan-application-eligibility.service';
import {
  TENANT_LOAN_APPLICATION_ELIGIBILITY_SNAPSHOT_SELECT,
  toTenantLoanApplicationEligibilityResponse,
  type TenantLoanApplicationEligibilityResponse,
} from '../../shared/utils/tenant-loan-application-eligibility.mapper';
import { resolveTenantLogoUrl } from '../../shared/utils/resolve-tenant-logo-url.util';
import { ListPublicTenantsQueryDto } from '../dto/list-public-tenants-query.dto';
import { buildPublicBrandCatalogWhere } from '../utils/build-public-brand-catalog-where.util';


const PUBLIC_AGREEMENT_SELECT = {
  id: true,
  version: true,
  title: true,
  content: true,
  type: true,
  status: true,
  effectiveDate: true,
  createdAt: true,
  updatedAt: true,
} as const;

const PUBLIC_TENANT_CATALOG_SELECT = {
  tenantId: true,
  tenantCode: true,
  slug: true,
  name: true,
  logoUrl: true,
  brandColor: true,
  subscriptionStatus: true,
  brandProfile: {
    select: {
      brandName: true,
      slogan: true,
      logoImgName: true,
    },
  },
  loanApplicationEligibility: {
    select: TENANT_LOAN_APPLICATION_ELIGIBILITY_SNAPSHOT_SELECT,
  },
} as const;

type CatalogTenant = Prisma.TenantGetPayload<{
  select: typeof PUBLIC_TENANT_CATALOG_SELECT;
}>;

const PUBLIC_TENANT_DETAIL_SELECT = {
  ...PUBLIC_TENANT_CATALOG_SELECT,
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

type DetailTenant = Prisma.TenantGetPayload<{
  select: typeof PUBLIC_TENANT_DETAIL_SELECT;
}> & {
  termsAndConditions: PublicBrandAgreement[];
};

export interface PublicTenantWorkspaceResponse {
  uuid: string;
  tenantCode: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
}

export interface PublicBrandCatalogItem {
  uuid: string;
  tenantCode: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  brandName: string | null;
  slogan: string | null;
  /** Actual subscription state (TRIAL | ACTIVE) for catalog badges. */
  subscriptionStatus: SubscriptionStatus;
  /** True only for authenticated platform customers who favorited this brand. */
  isFavorite: boolean;
  loanApplicationEligibility: TenantLoanApplicationEligibilityResponse;
}

/** Matches platform / tenant agreement response shape for shared frontend modules. */
export interface PublicBrandAgreement {
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

export interface PublicBrandDetail extends PublicBrandCatalogItem {
  about: BrandAboutFields;
  termsOfService: PublicBrandAgreement | null;
  privacyPolicy: PublicBrandAgreement | null;
}

export interface PublicBrandCatalogListResponse {
  data: PublicBrandCatalogItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class PublicTenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
    private readonly customerFavoritesService: CustomerFavoritesService,
    private readonly eligibility: TenantLoanApplicationEligibilityService,
    private readonly includeDemoTenantsSettings: IncludeDemoTenantsSettingsService,
  ) {}

  /** Public workspace / lookup resolve — demos never resolve here. */
  async resolve(
    identifier: string | null | undefined,
  ): Promise<PublicTenantWorkspaceResponse> {
    const tenant =
      await this.tenantService.resolveTenantByIdentifier(identifier);

    return {
      uuid: tenant.tenantId,
      tenantCode: tenant.tenantCode,
      slug: tenant.slug,
      name: tenant.name,
      logoUrl: tenant.logoUrl,
      brandColor: tenant.brandColor,
    };
  }

  async findAllPublic(
    query: ListPublicTenantsQueryDto,
    viewer?: AuthenticatedUser,
  ): Promise<PublicBrandCatalogListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const includeDemo = await this.shouldIncludeDemoTenants(viewer);
    const where = buildPublicBrandCatalogWhere(query.search, { includeDemo });

    const [total, rows, favoriteTenantIds] = await Promise.all([
      this.prisma.tenant.count({ where }),
      this.prisma.tenant.findMany({
        where,
        select: PUBLIC_TENANT_CATALOG_SELECT,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.resolveFavoriteTenantIds(viewer),
    ]);

    return {
      data: rows.map((row) =>
        this.toCatalogItem(row, favoriteTenantIds.has(row.tenantId)),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async findOnePublic(
    identifier: string,
    viewer?: AuthenticatedUser,
  ): Promise<PublicBrandDetail> {
    const trimmed = identifier.trim();

    if (trimmed.length === 0) {
      throw new NotFoundException(
        'Financial institution brand not found or unavailable',
      );
    }

    const includeDemo = await this.shouldIncludeDemoTenants(viewer);
    const now = new Date();
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        ...applicantActiveTenantWhere(includeDemo),
        OR: [
          { tenantId: trimmed },
          { slug: trimmed },
          { tenantCode: trimmed },
          { slug: trimmed.toLowerCase() },
          { tenantCode: trimmed.toUpperCase() },
        ],
      },
      select: {
        ...PUBLIC_TENANT_DETAIL_SELECT,
        termsAndConditions: {
          where: {
            status: AgreementStatus.PUBLISHED,
            effectiveDate: { lte: now },
          },
          select: PUBLIC_AGREEMENT_SELECT,
          orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(
        'Financial institution brand not found or unavailable',
      );
    }

    const favoriteTenantIds = await this.resolveFavoriteTenantIds(viewer);

    return {
      ...this.toDetail(tenant, favoriteTenantIds.has(tenant.tenantId)),
      loanApplicationEligibility: await this.eligibility.getForRead(
        tenant.tenantId,
      ),
    };
  }

  /**
   * Applicant catalog: platform customers get all active brands when the flag is on,
   * otherwise active excluding demos. Guests always get the exclude-demos set.
   * Responses never expose isDemo — customers only see a normal brand list.
   */
  private async shouldIncludeDemoTenants(
    viewer?: AuthenticatedUser,
  ): Promise<boolean> {
    if (!viewer?.id || viewer.tenantId != null) {
      return false;
    }

    return this.includeDemoTenantsSettings.isEnabled();
  }

  private async resolveFavoriteTenantIds(
    viewer?: AuthenticatedUser,
  ): Promise<Set<string>> {
    // Platform customers only (tenantId null). Anonymous / tenant staff → empty.
    if (!viewer?.id || viewer.tenantId != null) {
      return new Set();
    }

    return this.customerFavoritesService.getFavoriteTenantIdSet(viewer.id);
  }

  private toCatalogItem(
    tenant: {
      tenantId: string;
      tenantCode: string;
      slug: string;
      name: string;
      logoUrl: string | null;
      brandColor: string | null;
      subscriptionStatus: SubscriptionStatus;
      brandProfile: {
        brandName: string | null;
        slogan: string | null;
        logoImgName: string | null;
      } | null;
      loanApplicationEligibility: Parameters<
        typeof toTenantLoanApplicationEligibilityResponse
      >[1];
    },
    isFavorite: boolean,
  ): PublicBrandCatalogItem {
    return {
      uuid: tenant.tenantId,
      tenantCode: tenant.tenantCode,
      slug: tenant.slug,
      name: tenant.name,
      logoUrl: resolveTenantLogoUrl({
        logoUrl: tenant.logoUrl,
        logoImgName: tenant.brandProfile?.logoImgName,
      }),
      brandColor: tenant.brandColor,
      brandName: tenant.brandProfile?.brandName ?? null,
      slogan: tenant.brandProfile?.slogan ?? null,
      subscriptionStatus: tenant.subscriptionStatus,
      isFavorite,
      loanApplicationEligibility: toTenantLoanApplicationEligibilityResponse(
        tenant,
        tenant.loanApplicationEligibility,
      ),
    };
  }

  private toDetail(
    tenant: DetailTenant,
    isFavorite: boolean,
  ): PublicBrandDetail {
    const profile = tenant.brandProfile;

    return {
      ...this.toCatalogItem(tenant, isFavorite),
      about: {
        brandMission: profile?.brandMission ?? null,
        brandVision: profile?.brandVision ?? null,
        contactPhone: profile?.contactPhone ?? null,
        whatsappPhone: profile?.whatsappPhone ?? null,
        contactEmail: profile?.contactEmail ?? null,
        coreValues: profile?.coreValues ?? null,
      },
      termsOfService:
        tenant.termsAndConditions.find(
          (row) => row.type === AgreementType.TERMS_OF_SERVICE,
        ) ?? null,
      privacyPolicy:
        tenant.termsAndConditions.find(
          (row) => row.type === AgreementType.PRIVACY_POLICY,
        ) ?? null,
    };
  }
}
