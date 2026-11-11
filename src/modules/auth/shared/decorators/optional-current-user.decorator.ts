import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../guards/permission.guard';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

/**
 * Returns the authenticated principal when optional JWT succeeded; otherwise undefined.
 */
export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<Partial<AuthenticatedRequest>>();
    return request.user;
  },
);
