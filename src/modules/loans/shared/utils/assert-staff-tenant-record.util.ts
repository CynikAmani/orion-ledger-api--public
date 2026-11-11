import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

/**
 * Assert tenant staff membership matches a domain record's tenantId.
 * Mismatch → NotFound (no cross-tenant existence leak).
 */
export function assertStaffTenantMatchesRecord(
  callerTenantId: string,
  recordTenantId: string,
  notFoundMessage = 'Record was not found',
): void {
  if (callerTenantId !== recordTenantId) {
    throw new NotFoundException(notFoundMessage);
  }
}

/**
 * Guard: loan type must belong to the same institution as the loan / issue target.
 */
export function assertLoanTypeBelongsToTenant(
  loanTypeTenantId: string,
  targetTenantId: string,
): void {
  if (loanTypeTenantId !== targetTenantId) {
    throw new BadRequestException(
      'Loan type does not belong to the caller\'s institution',
    );
  }
}
