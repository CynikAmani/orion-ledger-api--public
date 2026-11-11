export const TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS = {
  READY: 'READY',
  NOT_READY: 'NOT_READY',
} as const;

export type TenantLoanApplicationEligibilityStatus =
  (typeof TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS)[keyof typeof TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS];

export const TENANT_LOAN_APPLICATION_MISSING_REQUIREMENTS = {
  INTEREST_RATES: 'INTEREST_RATES',
  BRAND_PROFILE: 'BRAND_PROFILE',
  TERMS_OF_SERVICE: 'TERMS_OF_SERVICE',
  PRIVACY_POLICY: 'PRIVACY_POLICY',
} as const;

export type TenantLoanApplicationMissingRequirement =
  (typeof TENANT_LOAN_APPLICATION_MISSING_REQUIREMENTS)[keyof typeof TENANT_LOAN_APPLICATION_MISSING_REQUIREMENTS];

/** Prisma 1:1 filter: snapshot exists and the institution can take applications. */
export const TENANT_READY_FOR_LOAN_APPLICATIONS_WHERE = {
  loanApplicationEligibility: {
    is: {
      isEligible: true,
      status: TENANT_LOAN_APPLICATION_ELIGIBILITY_STATUS.READY,
    },
  },
} as const;
