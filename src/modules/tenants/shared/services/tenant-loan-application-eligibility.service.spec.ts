import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AgreementType } from '@prisma/client';
import { APP_ERROR_CODES } from '../../../../common/exceptions/app-http.exception';
import { TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS } from '../constants/tenant-loan-application-eligibility.constant';
import { TenantLoanApplicationEligibilityService } from './tenant-loan-application-eligibility.service';

describe('TenantLoanApplicationEligibilityService', () => {
  const findUniqueTenant = jest.fn<(args?: unknown) => Promise<unknown>>();
  const findFirstRate = jest.fn<(args?: unknown) => Promise<unknown>>();
  const findManyAgreements = jest.fn<(args?: unknown) => Promise<unknown>>();
  const upsertEligibility = jest.fn<(args?: unknown) => Promise<unknown>>();

  const tenantBase = {
    tenantId: 'tenant-uuid',
    slug: 'acme',
    tenantCode: 'ACME',
    logoUrl: 'logo.png',
    brandProfile: { brandName: 'Acme Credit', logoImgName: 'logo.png' },
  };

  const readySnapshot = {
    status: TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS.READY,
    isEligible: true,
    hasInterestRates: true,
    hasBrandProfile: true,
    hasTermsOfService: true,
    hasPrivacyPolicy: true,
    subscription: null,
    computedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  let service: TenantLoanApplicationEligibilityService;

  beforeEach(() => {
    jest.clearAllMocks();
    upsertEligibility.mockResolvedValue(readySnapshot);

    service = new TenantLoanApplicationEligibilityService({
      tenant: { findUnique: findUniqueTenant },
      interestRate: { findFirst: findFirstRate },
      termsAndConditions: { findMany: findManyAgreements },
      tenantLoanApplicationEligibility: { upsert: upsertEligibility },
    } as never);
  });

  it('returns the stored flag without scanning when READY', async () => {
    findUniqueTenant.mockResolvedValue({
      ...tenantBase,
      loanApplicationEligibility: readySnapshot,
    });

    const result = await service.getForRead('tenant-uuid');

    expect(result.isEligible).toBe(true);
    expect(result.status).toBe('READY');
    expect(result.uuid).toBe('tenant-uuid');
    expect(result.slug).toBe('acme');
    expect(findFirstRate).not.toHaveBeenCalled();
    expect(findManyAgreements).not.toHaveBeenCalled();
    expect(upsertEligibility).not.toHaveBeenCalled();
  });

  it('rescans and stores when NOT_READY', async () => {
    findUniqueTenant.mockResolvedValue({
      ...tenantBase,
      brandProfile: { brandName: null, logoImgName: null },
      logoUrl: null,
      loanApplicationEligibility: {
        ...readySnapshot,
        status: TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS.NOT_READY,
        isEligible: false,
        hasInterestRates: false,
        hasBrandProfile: false,
        hasTermsOfService: false,
        hasPrivacyPolicy: false,
      },
    });
    findFirstRate.mockResolvedValue(null);
    findManyAgreements.mockResolvedValue([]);
    upsertEligibility.mockResolvedValue({
      ...readySnapshot,
      status: TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS.NOT_READY,
      isEligible: false,
      hasInterestRates: false,
      hasBrandProfile: false,
      hasTermsOfService: false,
      hasPrivacyPolicy: false,
    });

    const result = await service.getForRead('tenant-uuid');

    expect(findFirstRate).toHaveBeenCalled();
    expect(findManyAgreements).toHaveBeenCalled();
    expect(upsertEligibility).toHaveBeenCalled();
    expect(result.isEligible).toBe(false);
    expect(result.missingRequirements).toEqual([
      'INTEREST_RATES',
      'BRAND_PROFILE',
      'TERMS_OF_SERVICE',
      'PRIVACY_POLICY',
    ]);
  });

  it('treats published TOS + privacy as complete agreements', async () => {
    findUniqueTenant.mockResolvedValue({
      ...tenantBase,
      loanApplicationEligibility: null,
    });
    findFirstRate.mockResolvedValue({ rateId: 1 });
    findManyAgreements.mockResolvedValue([
      { type: AgreementType.TERMS_OF_SERVICE },
      { type: AgreementType.PRIVACY_POLICY },
    ]);

    await service.refresh('tenant-uuid');

    expect(upsertEligibility).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          isEligible: true,
          status: 'READY',
          hasInterestRates: true,
          hasBrandProfile: true,
          hasTermsOfService: true,
          hasPrivacyPolicy: true,
        }),
      }),
    );
  });

  it('throws a structured 422 when apply is blocked', async () => {
    findUniqueTenant.mockResolvedValue({
      ...tenantBase,
      loanApplicationEligibility: readySnapshot,
    });
    findUniqueTenant.mockResolvedValueOnce({
      ...tenantBase,
      loanApplicationEligibility: {
        ...readySnapshot,
        isEligible: false,
        status: TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS.NOT_READY,
        hasInterestRates: false,
      },
    });
    findFirstRate.mockResolvedValue(null);
    findManyAgreements.mockResolvedValue([
      { type: AgreementType.TERMS_OF_SERVICE },
      { type: AgreementType.PRIVACY_POLICY },
    ]);
    upsertEligibility.mockResolvedValue({
      ...readySnapshot,
      isEligible: false,
      status: TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS.NOT_READY,
      hasInterestRates: false,
    });

    try {
      await service.assertReadyForLoanApplications('tenant-uuid');
      throw new Error('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      const exception = error as HttpException;
      expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(exception.getResponse()).toEqual(
        expect.objectContaining({
          errorCode: APP_ERROR_CODES.TENANT_NOT_READY_FOR_LOAN_APPLICATIONS,
          eligibility: expect.objectContaining({
            isEligible: false,
            missingRequirements: expect.arrayContaining(['INTEREST_RATES']),
          }),
        }),
      );
    }
  });
});
