import { CustomDecorator, SetMetadata } from '@nestjs/common';

export const ALLOW_EXPIRED_SUBSCRIPTION_KEY = 'allowExpiredSubscription';

/**
 * Tenant routes that must keep working after coverage ends:
 * session, profile shell, agreements, and subscription renewal.
 */
export const AllowExpiredSubscription = (): CustomDecorator<string> =>
  SetMetadata(ALLOW_EXPIRED_SUBSCRIPTION_KEY, true);
