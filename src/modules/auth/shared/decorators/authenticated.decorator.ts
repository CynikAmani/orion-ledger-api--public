import { SetMetadata } from '@nestjs/common';

export const IS_AUTHENTICATED_KEY = 'isAuthenticated';

/**
 * Marks a route as requiring a valid JWT only (no specific permission).
 * Use for intentional auth-only customer/self surfaces.
 */
export const Authenticated = () => SetMetadata(IS_AUTHENTICATED_KEY, true);
