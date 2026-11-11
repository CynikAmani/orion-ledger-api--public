import { SetMetadata } from '@nestjs/common';

/**
 * Attempt JWT validation when a Bearer token is present; continue as anonymous
 * when missing/invalid. Pair with @Public() so PermissionGuard still allows the route.
 */
export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
