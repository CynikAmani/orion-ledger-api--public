import { describe, expect, it } from '@jest/globals';
import { TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS } from '../constants/tenant-loan-application-eligibility.constant';
import { toTenantLoanApplicationEligibilityResponse } from './tenant-loan-application-eligibility.mapper';

describe('toTenantLoanApplicationEligibilityResponse', () => {
  it('maps a missing snapshot to NOT_READY with every requirement listed', () => {
    const result = toTenantLoanApplicationEligibilityResponse(
      { tenantId: 'tenant-uuid', slug: 'acme', tenantCode: 'ACME' },
      null,
    );

    expect(result).toEqual({
      uuid: 'tenant-uuid',
      slug: 'acme',
      tenantCode: 'ACME',
      status: TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS.NOT_READY,
      isEligible: false,
      criteria: {
        hasInterestRates: false,
        hasBrandProfile: false,
        hasTermsOfService: false,
        hasPrivacyPolicy: false,
      },
      missingRequirements: [
        'INTEREST_RATES',
        'BRAND_PROFILE',
        'TERMS_OF_SERVICE',
        'PRIVACY_POLICY',
      ],
      subscription: null,
      computedAt: null,
    });
  });
});
