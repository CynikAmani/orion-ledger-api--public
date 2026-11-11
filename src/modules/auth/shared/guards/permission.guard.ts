import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import {
  APP_ERROR_CODES,
  appHttpException,
} from '../../../../common/exceptions/app-http.exception';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_AUTHENTICATED_KEY } from '../decorators/authenticated.decorator';
import { PERMISSION_METADATA_KEY } from '../decorators/permission.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PermissionType } from '../constants/permissions.constant';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

export type { AuthenticatedUser } from '../types/authenticated-user.type';

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Browsers send unauthenticated OPTIONS preflight; never require permissions.
    if (
      context.switchToHttp().getRequest<AuthenticatedRequest>().method ===
      'OPTIONS'
    ) {
      return true;
    }

    const targets = [context.getHandler(), context.getClass()];

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
    if (isPublic) {
      return true;
    }

    const requiredPermission = this.reflector.getAllAndOverride<
      PermissionType | undefined
    >(PERMISSION_METADATA_KEY, targets);

    if (requiredPermission) {
      return this.assertHasPermission(context, requiredPermission);
    }

    const isAuthenticatedOnly = this.reflector.getAllAndOverride<boolean>(
      IS_AUTHENTICATED_KEY,
      targets,
    );

    if (isAuthenticatedOnly) {
      return this.assertIsAuthenticated(context);
    }

    throw new ForbiddenException('Route missing permission declaration');
  }

  private assertIsAuthenticated(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.userId;

    if (!userId) {
      throw appHttpException(
        HttpStatus.UNAUTHORIZED,
        'Authentication required',
        APP_ERROR_CODES.AUTHENTICATION_REQUIRED,
      );
    }

    return true;
  }

  private assertHasPermission(
    context: ExecutionContext,
    requiredPermission: PermissionType,
  ): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { userId, permissions } = request.user ?? {};

    if (!userId || !permissions) {
      throw appHttpException(
        HttpStatus.UNAUTHORIZED,
        'Authentication required',
        APP_ERROR_CODES.AUTHENTICATION_REQUIRED,
      );
    }

    if (!permissions.includes(requiredPermission)) {
      throw new ForbiddenException('Access denied: insufficient permissions');
    }

    return true;
  }
}
