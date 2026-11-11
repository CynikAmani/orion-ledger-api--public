import { ForbiddenException } from '@nestjs/common';
import { CUSTOMER_ROLE_KEY } from '../../auth/shared/constants/roles.constant';
import type { AuthenticatedUser } from '../../auth/shared/types/authenticated-user.type';

/** Platform staff only. Institution members and customers are rejected. */
export function assertPlatformSubscriptionOperator(
  user: AuthenticatedUser,
): void {
  if (user.tenantId) {
    throw new ForbiddenException(
      'Only platform staff can record subscriptions',
    );
  }

  if (user.roles.includes(CUSTOMER_ROLE_KEY)) {
    throw new ForbiddenException('Customers cannot record subscriptions');
  }
}
