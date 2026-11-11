import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import {
  APP_ERROR_CODES,
  appHttpException,
} from '../../../../common/exceptions/app-http.exception';
import { Reflector } from '@nestjs/core';
import { ALLOW_EXPIRED_SUBSCRIPTION_KEY } from '../decorators/allow-expired-subscription.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { tenantSubscriptionAllowsRequests } from '../../../subscriptions/utils/subscription-access.util';
import type { AuthenticatedRequest } from './permission.guard';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      targets,
    );
    if (isPublic) {
      return true;
    }

    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_EXPIRED_SUBSCRIPTION_KEY,
      targets,
    );
    if (allowed) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user?.tenantId) {
      return true;
    }

    const access = request.user.subscriptionAccess;
    if (!access) {
      throw inactiveSubscriptionException();
    }

    if (
      tenantSubscriptionAllowsRequests({
        now: new Date(),
        subscriptionStatus: access.status,
        trialEndsAt: access.trialEndsAt,
        subscriptionAccessEndsAt: access.accessEndsAt,
      })
    ) {
      return true;
    }

    throw inactiveSubscriptionException();
  }
}

function inactiveSubscriptionException() {
  return appHttpException(
    HttpStatus.FORBIDDEN,
    'Institution subscription is inactive',
    APP_ERROR_CODES.SUBSCRIPTION_INACTIVE,
  );
}
