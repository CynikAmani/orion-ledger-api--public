import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../../../core/database/prisma.service';
import { IncludeDemoTenantsSettingsService } from '../../../system-configurations/platform/include-demo-tenants/services/include-demo-tenants-settings.service';
import { resolveTenantLogoUrl } from '../utils/resolve-tenant-logo-url.util';

/** Active applicant pool without the demo gate. */
export const APPLICANT_ACTIVE_TENANT_WHERE = {
  isActive: true,
  deletedAt: null,
  subscriptionStatus: {
    in: [SubscriptionStatus.TRIAL, SubscriptionStatus.PAID],
  },
} as const satisfies Prisma.TenantWhereInput;

/**
 * Public lookup / anonymous gate — always excludes demo institutions.
 */
export const PUBLIC_ACTIVE_TENANT_WHERE = {
  ...APPLICANT_ACTIVE_TENANT_WHERE,
  isDemo: false,
} as const satisfies Prisma.TenantWhereInput;

/** All active applicants, or active excluding demos. */
export function applicantActiveTenantWhere(
  includeDemo: boolean,
): Prisma.TenantWhereInput {
  return includeDemo
    ? APPLICANT_ACTIVE_TENANT_WHERE
    : PUBLIC_ACTIVE_TENANT_WHERE;
}

export interface ResolveTenantByIdentifierOptions {
  /**
   * When true, respects `include_demo_tenants_enabled` so demos can resolve.
   * Public lookups must never pass this.
   */
  allowDemoWhenEnabled?: boolean;
}

const RESOLVED_TENANT_SELECT = {
  tenantId: true,
  tenantCode: true,
  slug: true,
  name: true,
  logoUrl: true,
  brandColor: true,
  brandProfile: {
    select: {
      brandName: true,
      slogan: true,
      logoImgName: true,
    },
  },
} as const;

export interface ResolvedTenantBrandProfile {
  brandName: string | null;
  slogan: string | null;
  logoImgName: string | null;
}

/**
 * Active institution resolved by public identifier (slug or tenant code).
 * Used by domain services that must not query `Tenant` directly.
 */
export interface ResolvedTenant {
  tenantId: string;
  tenantCode: string;
  slug: string;
  name: string;
  /** Public logo path/URL when available (coalesced from logoUrl / logoImgName). */
  logoUrl: string | null;
  brandColor: string | null;
  brandProfile: ResolvedTenantBrandProfile | null;
}

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly includeDemoTenantsSettings: IncludeDemoTenantsSettingsService,
  ) {}

  /**
   * Resolve an active, non-deleted tenant on TRIAL/ACTIVE by slug or tenant code
   * (case-tolerant). Missing/blank identifiers (e.g. omitted `?tenant=`) 404.
   * Public lookups must omit `allowDemoWhenEnabled` so demos never resolve.
   */
  async resolveTenantByIdentifier(
    identifier: string | null | undefined,
    options?: ResolveTenantByIdentifierOptions,
  ): Promise<ResolvedTenant> {
    const trimmed = typeof identifier === 'string' ? identifier.trim() : '';

    if (trimmed.length === 0) {
      throw new NotFoundException(
        'Target institution is currently unavailable or inactive',
      );
    }

    const includeDemo =
      options?.allowDemoWhenEnabled === true &&
      (await this.includeDemoTenantsSettings.isEnabled());

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
      select: RESOLVED_TENANT_SELECT,
    });

    if (!tenant) {
      throw new NotFoundException(
        'Target institution is currently unavailable or inactive',
      );
    }

    return {
      tenantId: tenant.tenantId,
      tenantCode: tenant.tenantCode,
      slug: tenant.slug,
      name: tenant.name,
      logoUrl: resolveTenantLogoUrl({
        logoUrl: tenant.logoUrl,
        logoImgName: tenant.brandProfile?.logoImgName,
      }),
      brandColor: tenant.brandColor,
      brandProfile: tenant.brandProfile
        ? {
            brandName: tenant.brandProfile.brandName,
            slogan: tenant.brandProfile.slogan,
            logoImgName: tenant.brandProfile.logoImgName,
          }
        : null,
    };
  }
}
