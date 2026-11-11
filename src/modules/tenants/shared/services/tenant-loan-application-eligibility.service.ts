import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { AgreementStatus, AgreementType } from '@prisma/client';
import {
  APP_ERROR_CODES,
  appHttpException,
} from '../../../../common/exceptions/app-http.exception';
import { PrismaService } from '../../../../core/database/prisma.service';
import {
  TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS,
} from '../constants/tenant-loan-application-eligibility.constant';
import {
  missingFromCriteria,
  TENANT_LOAN_APPLICATION_ELIGIBILITY_SNAPSHOT_SELECT,
  toTenantLoanApplicationEligibilityResponse,
  type TenantLoanApplicationEligibilityCriteria,
  type TenantLoanApplicationEligibilityResponse,
} from '../utils/tenant-loan-application-eligibility.mapper';

const TENANT_ELIGIBILITY_SELECT = {
  tenantId: true,
  slug: true,
  tenantCode: true,
  logoUrl: true,
  brandProfile: {
    select: {
      brandName: true,
      logoImgName: true,
    },
  },
  loanApplicationEligibility: {
    select: TENANT_LOAN_APPLICATION_ELIGIBILITY_SNAPSHOT_SELECT,
  },
} as const;

@Injectable()
export class TenantLoanApplicationEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Read path: return the stored READY flag; recompute while NOT_READY/missing.
   */
  async getForRead(
    tenantId: string,
  ): Promise<TenantLoanApplicationEligibilityResponse> {
    const tenant = await this.loadTenant(tenantId);
    const snapshot = tenant.loanApplicationEligibility;

    if (
      snapshot?.status === TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS.READY &&
      snapshot.isEligible
    ) {
      return toTenantLoanApplicationEligibilityResponse(tenant, snapshot);
    }

    return this.refresh(tenantId);
  }

  /**
   * Write path and NOT_READY reads: scan setup tables for this tenant only.
   */
  async refresh(
    tenantId: string,
  ): Promise<TenantLoanApplicationEligibilityResponse> {
    const tenant = await this.loadTenant(tenantId);
    const now = new Date();

    const [rate, agreements] = await Promise.all([
      this.prisma.interestRate.findFirst({
        where: { tenantId },
        select: { rateId: true },
      }),
      this.prisma.termsAndConditions.findMany({
        where: {
          tenantId,
          status: AgreementStatus.PUBLISHED,
          effectiveDate: { lte: now },
          type: {
            in: [AgreementType.TERMS_OF_SERVICE, AgreementType.PRIVACY_POLICY],
          },
        },
        select: { type: true },
      }),
    ]);

    const hasBrandName = Boolean(tenant.brandProfile?.brandName?.trim());
    const hasLogo = Boolean(
      tenant.brandProfile?.logoImgName?.trim() || tenant.logoUrl?.trim(),
    );

    const criteria: TenantLoanApplicationEligibilityCriteria = {
      hasInterestRates: rate !== null,
      hasBrandProfile: hasBrandName && hasLogo,
      hasTermsOfService: agreements.some(
        (row) => row.type === AgreementType.TERMS_OF_SERVICE,
      ),
      hasPrivacyPolicy: agreements.some(
        (row) => row.type === AgreementType.PRIVACY_POLICY,
      ),
    };

    const missingRequirements = missingFromCriteria(criteria);
    const isEligible = missingRequirements.length === 0;
    const status = isEligible
      ? TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS.READY
      : TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS.NOT_READY;
    const computedAt = now;

    const snapshot = await this.prisma.tenantLoanApplicationEligibility.upsert({
      where: { tenantId },
      create: {
        tenantId,
        status,
        isEligible,
        ...criteria,
        computedAt,
      },
      update: {
        status,
        isEligible,
        ...criteria,
        computedAt,
      },
      select: TENANT_LOAN_APPLICATION_ELIGIBILITY_SNAPSHOT_SELECT,
    });

    return toTenantLoanApplicationEligibilityResponse(tenant, snapshot);
  }

  async assertReadyForLoanApplications(tenantId: string): Promise<void> {
    const eligibility = await this.getForRead(tenantId);

    if (eligibility.isEligible) {
      return;
    }

    throw appHttpException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'This institution is not set up for loan applications yet',
      APP_ERROR_CODES.TENANT_NOT_READY_FOR_LOAN_APPLICATIONS,
      { eligibility },
    );
  }

  private async loadTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { tenantId },
      select: TENANT_ELIGIBILITY_SELECT,
    });

    if (!tenant) {
      throw new NotFoundException(
        'Target institution is currently unavailable or inactive',
      );
    }

    return tenant;
  }
}
