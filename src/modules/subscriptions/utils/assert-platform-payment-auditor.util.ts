import { ForbiddenException } from '@nestjs/common';
import { CUSTOMER_ROLE_KEY } from '../../auth/shared/constants/roles.constant';
import type { AuthenticatedUser } from '../../auth/shared/types/authenticated-user.type';

/** Platform staff only. Institution members and customers are rejected. */
export function assertPlatformPaymentAuditor(user: AuthenticatedUser): void {
  if (user.tenantId) {
    throw new ForbiddenException(
      'Only platform staff can view payment transactions',
    );
  }

  if (user.roles.includes(CUSTOMER_ROLE_KEY)) {
    throw new ForbiddenException('Customers cannot view payment transactions');
  }
}
