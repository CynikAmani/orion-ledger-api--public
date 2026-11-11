import { HttpStatus, Injectable } from '@nestjs/common';
import {
  APP_ERROR_CODES,
  appHttpException,
} from '../../../../common/exceptions/app-http.exception';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../../core/database/prisma.service';
import { UserAccountLifecycleValidator } from '../../../users/shared/validators/user-account-lifecycle.validator';
import type { AuthenticatedUser } from '../types/authenticated-user.type';
import { toAuthenticatedUser } from '../utils/authenticated-user.mapper';
import { extractAccessTokenFromCookie } from '../utils/auth-cookie.util';
import {
  resolveSessionUserPk,
  type DecodedAccessToken,
} from '../utils/session-jwt-payload.util';
import { authenticatedUserSelect } from '../utils/user-authorization.util';
import { permissionsForSandboxSession } from '../../../sandbox/utils/sandbox-permissions.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userAccountLifecycleValidator: UserAccountLifecycleValidator,
  ) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is not defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: Request) => extractAccessTokenFromCookie(request),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: DecodedAccessToken): Promise<AuthenticatedUser> {
    const id = resolveSessionUserPk(payload);

    if (!id) {
      throw appHttpException(
        HttpStatus.UNAUTHORIZED,
        'Invalid credentials',
        APP_ERROR_CODES.AUTHENTICATION_REQUIRED,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: authenticatedUserSelect,
    });

    if (!user || user.deletedAt !== null) {
      throw appHttpException(
        HttpStatus.UNAUTHORIZED,
        'Invalid credentials',
        APP_ERROR_CODES.AUTHENTICATION_REQUIRED,
      );
    }

    // isBlocked is an operational hold (loans/savings/approvals), not an auth lock.
    // deletedAt rejects the session. Authorization is loaded from PostgreSQL.
    this.userAccountLifecycleValidator.assertTenantMemberHasAssignedRoles({
      userId: user.userId,
      tenantId: user.tenantId,
      userRoles: user.userRoles,
    });

    const authenticated = toAuthenticatedUser(user);
    const demoUser = await this.prisma.demoUser.findUnique({
      where: { userId: user.id },
      select: { userId: true },
    });

    // Login and session responses keep the full catalog. This list is only
    // what PermissionGuard enforces on the request. Visit expiry is enforced
    // on that visit's refresh token, so other visits for this user stay up.
    return {
      ...authenticated,
      permissions: permissionsForSandboxSession(
        authenticated.permissions,
        demoUser !== null,
      ),
    };
  }
}
