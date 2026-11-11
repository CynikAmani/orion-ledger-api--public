import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { resolveTenantBrandName } from '../utils/resolve-tenant-brand-name.util';

/**
 * Resolves the customer-facing brand name for a tenant.
 * Use this for loan/repayment emails and notifications — never hardcode a lender.
 */
@Injectable()
export class TenantBrandNameService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveDisplayName(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { tenantId },
      select: {
        name: true,
        brandProfile: {
          select: { brandName: true },
        },
      },
    });

    return resolveTenantBrandName({
      tenantName: tenant?.name,
      brandName: tenant?.brandProfile?.brandName,
    });
  }
}
