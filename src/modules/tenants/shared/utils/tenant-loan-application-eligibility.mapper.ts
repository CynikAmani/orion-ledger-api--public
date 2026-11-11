import type { Prisma } from '@prisma/client';
import {
  TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS,
  TENANT_LOAN_APPLICATION_MISSING_REQUIREMENTS,
  type TenantLoanApplicationEligibilityStatus,
  type TenantLoanApplicationMissingRequirement,
} from '../constants/tenant-loan-application-eligibility.constant';

export const TENANT_LOAN_APPLICATION_ELIGIBILITY_SNAPSHOT_SELECT = {
  status: true,
  isEligible: true,
  hasInterestRates: true,
  hasBrandProfile: true,
  hasTermsOfService: true,
  hasPrivacyPolicy: true,
  subscription: true,
  computedAt: true,
} as const;

export type TenantLoanApplicationEligibilitySnapshot = Prisma.TenantLoanApplicationEligibilityGetPayload<{
  select: typeof TENANT_LOAN_APPLICATION_ELIGIBILITY_SNAPSHOT_SELECT;
}>;

export interface TenantLoanApplicationEligibilityCriteria {
  hasInterestRates: boolean;
  hasBrandProfile: boolean;
  hasTermsOfService: boolean;
  hasPrivacyPolicy: boolean;
}

export interface TenantLoanApplicationEligibilityResponse {
  uuid: string;
  slug: string;
  tenantCode: string;
  status: TenantLoanApplicationEligibilityStatus;
  isEligible: boolean;
  criteria: TenantLoanApplicationEligibilityCriteria;
  missingRequirements: TenantLoanApplicationMissingRequirement[];
  subscription: Record<string, unknown> | null;
  computedAt: string | null;
}

export function toTenantLoanApplicationEligibilityResponse(
  tenant: { tenantId: string; slug: string; tenantCode: string },
  snapshot: TenantLoanApplicationEligibilitySnapshot | null,
): TenantLoanApplicationEligibilityResponse {
  const criteria: TenantLoanApplicationEligibilityCriteria = {
    hasInterestRates: snapshot?.hasInterestRates ?? false,
    hasBrandProfile: snapshot?.hasBrandProfile ?? false,
    hasTermsOfService: snapshot?.hasTermsOfService ?? false,
    hasPrivacyPolicy: snapshot?.hasPrivacyPolicy ?? false,
  };

  const missingRequirements = missingFromCriteria(criteria);
  const isEligible = snapshot?.isEligible ?? missingRequirements.length === 0;
  const status: TenantLoanApplicationEligibilityStatus = isEligible
    ? TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS.READY
    : TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS.NOT_READY;

  return {
    uuid: tenant.tenantId,
    slug: tenant.slug,
    tenantCode: tenant.tenantCode,
    status,
    isEligible,
    criteria,
    missingRequirements,
    subscription: toPublicSubscription(snapshot?.subscription ?? null),
    computedAt: snapshot?.computedAt?.toISOString() ?? null,
  };
}

export function missingFromCriteria(
  criteria: TenantLoanApplicationEligibilityCriteria,
): TenantLoanApplicationMissingRequirement[] {
  const missing: TenantLoanApplicationMissingRequirement[] = [];

  if (!criteria.hasInterestRates) {
    missing.push(TENANT_LOAN_APPLICATION_MISSING_REQUIREMENTS.INTEREST_RATES);
  }
  if (!criteria.hasBrandProfile) {
    missing.push(TENANT_LOAN_APPLICATION_MISSING_REQUIREMENTS.BRAND_PROFILE);
  }
  if (!criteria.hasTermsOfService) {
    missing.push(TENANT_LOAN_APPLICATION_MISSING_REQUIREMENTS.TERMS_OF_SERVICE);
  }
  if (!criteria.hasPrivacyPolicy) {
    missing.push(TENANT_LOAN_APPLICATION_MISSING_REQUIREMENTS.PRIVACY_POLICY);
  }

  return missing;
}

function toPublicSubscription(
  value: Prisma.JsonValue | null,
): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}