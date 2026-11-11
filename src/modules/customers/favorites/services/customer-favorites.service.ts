import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../core/database/prisma.service';
import { IncludeDemoTenantsSettingsService } from '../../../system-configurations/platform/include-demo-tenants/services/include-demo-tenants-settings.service';
import { applicantActiveTenantWhere } from '../../../tenants/shared/services/tenant.service';
import { resolveTenantLogoUrl } from '../../../tenants/shared/utils/resolve-tenant-logo-url.util';
import { ListCustomerFavoritesQueryDto } from '../dto/list-customer-favorites-query.dto';

const FAVORITE_TENANT_SELECT = {
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

type FavoriteTenantRow = Prisma.TenantGetPayload<{
  select: typeof FAVORITE_TENANT_SELECT;
}>;

export interface CustomerFavoriteTenantItem {
  favoriteId: string;
  favoritedAt: Date;
  tenantUuid: string;
  tenantCode: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  brandName: string | null;
  slogan: string | null;
}

export interface CustomerFavoriteTenantListResponse {
  data: CustomerFavoriteTenantItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class CustomerFavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly includeDemoTenantsSettings: IncludeDemoTenantsSettingsService,
  ) {}

  /**
   * Tenant UUIDs favorited by this customer — for public catalog projection.
   */
  async getFavoriteTenantIdSet(customerId: number): Promise<Set<string>> {
    const rows = await this.prisma.customerFavoriteTenant.findMany({
      where: { customerId },
      select: { tenantId: true },
    });

    return new Set(rows.map((row) => row.tenantId));
  }

  async mark(
    customerId: number,
    tenantUuid: string,
  ): Promise<CustomerFavoriteTenantItem> {
    const includeDemo = await this.includeDemoTenantsSettings.isEnabled();
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        tenantId: tenantUuid.trim(),
        ...applicantActiveTenantWhere(includeDemo),
      },
      select: FAVORITE_TENANT_SELECT,
    });

    if (!tenant) {
      throw new NotFoundException(
        'Financial institution brand not found or unavailable',
      );
    }

    const favorite = await this.prisma.customerFavoriteTenant.upsert({
      where: {
        unique_customer_favorite_tenant: {
          customerId,
          tenantId: tenant.tenantId,
        },
      },
      create: {
        customerId,
        tenantId: tenant.tenantId,
      },
      update: {},
      select: {
        favoriteId: true,
        createdAt: true,
      },
    });

    return this.toItem(favorite.favoriteId, favorite.createdAt, tenant);
  }

  async unmark(customerId: number, tenantUuid: string): Promise<void> {
    const tenantId = tenantUuid.trim();
    if (tenantId.length === 0) {
      return;
    }

    await this.prisma.customerFavoriteTenant.deleteMany({
      where: {
        customerId,
        tenantId,
      },
    });
  }

  async findAllForCustomer(
    customerId: number,
    query: ListCustomerFavoritesQueryDto,
  ): Promise<CustomerFavoriteTenantListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const includeDemo = await this.includeDemoTenantsSettings.isEnabled();

    const where: Prisma.CustomerFavoriteTenantWhereInput = {
      customerId,
      tenant: applicantActiveTenantWhere(includeDemo),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.customerFavoriteTenant.count({ where }),
      this.prisma.customerFavoriteTenant.findMany({
        where,
        select: {
          favoriteId: true,
          createdAt: true,
          tenant: { select: FAVORITE_TENANT_SELECT },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((row) =>
        this.toItem(row.favoriteId, row.createdAt, row.tenant),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  private toItem(
    favoriteId: string,
    favoritedAt: Date,
    tenant: FavoriteTenantRow,
  ): CustomerFavoriteTenantItem {
    return {
      favoriteId,
      favoritedAt,
      tenantUuid: tenant.tenantId,
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
    };
  }
}
