import type { Prisma } from '@prisma/client';
import { TENANT_READY_FOR_LOAN_APPLICATIONS_WHERE } from '../../shared/constants/tenant-loan-application-eligibility.constant';
import { applicantActiveTenantWhere } from '../../shared/services/tenant.service';

export interface BuildPublicBrandCatalogWhereOptions {
  /**
   * When true, demo institutions are eligible for the catalog.
   * Public / anonymous browse must keep this false.
   */
  includeDemo?: boolean;
}

/**
 * Browse (no search): only institutions that can accept loan applications.
 * Search: any active brand matching the query, eligible or not.
 */
export function buildPublicBrandCatalogWhere(
  search?: string,
  options?: BuildPublicBrandCatalogWhereOptions,
): Prisma.TenantWhereInput {
  const trimmed = search?.trim();
  const base = applicantActiveTenantWhere(options?.includeDemo === true);

  if (!trimmed) {
    return {
      ...base,
      ...TENANT_READY_FOR_LOAN_APPLICATIONS_WHERE,
    };
  }

  return {
    ...base,
    OR: [
      { name: { contains: trimmed, mode: 'insensitive' } },
      { slug: { contains: trimmed, mode: 'insensitive' } },
      { tenantCode: { equals: trimmed.toUpperCase() } },
      {
        brandProfile: {
          is: {
            brandName: { contains: trimmed, mode: 'insensitive' },
          },
        },
      },
    ],
  };
}
