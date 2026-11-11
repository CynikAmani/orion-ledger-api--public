import { describe, expect, it } from '@jest/globals';
import { TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS } from '../../shared/constants/tenant-loan-application-eligibility.constant';
import { buildPublicBrandCatalogWhere } from './build-public-brand-catalog-where.util';

describe('buildPublicBrandCatalogWhere', () => {
  it('limits browse (no search) to READY institutions and excludes demos by default', () => {
    expect(buildPublicBrandCatalogWhere()).toEqual(
      expect.objectContaining({
        isActive: true,
        isDemo: false,
        loanApplicationEligibility: {
          is: {
            isEligible: true,
            status: TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS.READY,
          },
        },
      }),
    );
  });

  it('does not eligibility-filter a named search', () => {
    const where = buildPublicBrandCatalogWhere('  acme  ');

    expect(where.isDemo).toBe(false);
    expect(where.loanApplicationEligibility).toBeUndefined();
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { name: { contains: 'acme', mode: 'insensitive' } },
        { tenantCode: { equals: 'ACME' } },
      ]),
    );
  });

  it('omits the demo gate when includeDemo is true', () => {
    const where = buildPublicBrandCatalogWhere(undefined, { includeDemo: true });

    expect(where).not.toHaveProperty('isDemo');
    expect(where).toEqual(
      expect.objectContaining({
        isActive: true,
        loanApplicationEligibility: {
          is: {
            isEligible: true,
            status: TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS.READY,
          },
        },
      }),
    );
  });
});
