import {
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable, from, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  APP_ERROR_CODES,
  appHttpException,
} from '../../../../common/exceptions/app-http.exception';
import { IS_OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<{ method?: string }>();
    // Browsers send unauthenticated OPTIONS preflight; never require JWT.
    if (request.method === 'OPTIONS') {
      return true;
    }

    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      targets,
    );
    const isOptionalAuth = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH_KEY,
      targets,
    );

    if (isOptionalAuth) {
      return this.activateOptional(context);
    }

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = AuthenticatedUser>(
    err: Error | null,
    user: TUser | false,
    _info?: unknown,
    context?: ExecutionContext,
  ): TUser {
    const isOptionalAuth = context
      ? this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, [
          context.getHandler(),
          context.getClass(),
        ])
      : false;

    if (isOptionalAuth) {
      if (err || !user) {
        return undefined as TUser;
      }
      return user;
    }

    if (err || !user) {
      if (err) {
        throw err;
      }

      if (isAccessTokenExpiredInfo(_info)) {
        throw appHttpException(
          HttpStatus.UNAUTHORIZED,
          'Access token expired',
          APP_ERROR_CODES.ACCESS_TOKEN_EXPIRED,
        );
      }

      throw appHttpException(
        HttpStatus.UNAUTHORIZED,
        'Authentication required',
        APP_ERROR_CODES.AUTHENTICATION_REQUIRED,
      );
    }

    return user;
  }

  private activateOptional(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const result = super.canActivate(context);

    if (result instanceof Observable) {
      return result.pipe(
        map(() => true),
        catchError(() => of(true)),
      );
    }

    return from(Promise.resolve(result)).pipe(
      map(() => true),
      catchError(() => of(true)),
    );
  }
}

function isAccessTokenExpiredInfo(info: unknown): boolean {
  if (typeof info === 'string') {
    return /expired/i.test(info);
  }

  if (!info || typeof info !== 'object') {
    return false;
  }

  const record = info as { name?: unknown; message?: unknown };
  const name = typeof record.name === 'string' ? record.name : '';
  const message = typeof record.message === 'string' ? record.message : '';

  return name === 'TokenExpiredError' || /jwt expired/i.test(message);
}
