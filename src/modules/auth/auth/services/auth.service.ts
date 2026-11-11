import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import { BrevoEmailService } from '../../../../core/email/services/brevo-email.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import { UserAccountLifecycleValidator } from '../../../users/shared/validators/user-account-lifecycle.validator';
import {
  APP_ERROR_CODES,
  appHttpException,
} from '../../../../common/exceptions/app-http.exception';
import { hashPassword } from '../../shared/utils/hash-password.util';
import { findOrCreatePlatformCustomerRole } from '../../shared/utils/ensure-platform-role.util';
import {
  cappedAccessTtlSeconds,
  resolveJwtExpiresIn,
} from '../../shared/utils/jwt-expiration.util';
import { buildSessionJwtClaims } from '../../shared/utils/session-jwt-payload.util';
import { isSystemRootUserByRoleKeys } from '../../shared/utils/system-root-user.util';
import { LoginDto } from '../dto/login.dto';
import { SignupDto } from '../dto/signup.dto';
import { buildWelcomeEmail } from '../templates/welcome.email';
import { AuthPayloadService } from './auth-payload.service';
import type { TenantSubscriptionAccessResponse } from '../../../subscriptions/services/tenant-subscriptions.service';
import type { SupportInboxSignal } from '../../../support/tickets/services/support-inbox-signal.service';
import type { TenantLoanApplicationEligibilityResponse } from '../../../tenants/shared/utils/tenant-loan-application-eligibility.mapper';
import {
  MfaService,
  type MfaRequiredResponse,
} from '../../mfa/services/mfa.service';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const LOGIN_CREDENTIAL_SELECT = {
  id: true,
  userId: true,
  password: true,
  fullname: true,
  email: true,
  isMfaEnabled: true,
  deletedAt: true,
  tenantId: true,
  userRoles: {
    select: {
      roleId: true,
      role: { select: { key: true } },
    },
  },
} as const;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginTenantTheme {
  tenantId: string;
  /** Immutable workspace slug (same as public catalog / onboard). */
  slug: string;
  brandColor: string | null;
  brandName: string | null;
  logoImgName: string | null;
  /** Public img src (`/uploads/...` or absolute URL). Null when no logo is set. */
  logoUrl: string | null;
  loanApplicationEligibility: TenantLoanApplicationEligibilityResponse;
  /** Same payload as GET /subscriptions/access, captured at login and session recovery. */
  subscription: TenantSubscriptionAccessResponse;
}

export interface LoginUserPayload {
  userId: string;
  fullname: string;
  email: string | null;
  phone: string | null;
  nationalId: string;
  genderId: number | null;
  districtId: number | null;
  isBlocked: boolean | null;
  isNewUser: boolean;
  hasPassword: boolean;
  roles: string[];
  permissions: string[];
  /**
   * Platform global kill-switch for online PayChangu checkout (subscriptions and
   * repayments). Same source as GET/PATCH system-configurations/online-repayments.
   * When false, clients should show manual-payment UX; existing permissions still
   * apply when true.
   */
  onlineRepaymentsEnabled: boolean;
  /**
   * Support shortcut captured at login and session recovery.
   * Staff: newTicketCount is the badge, replyCount lights the icon.
   * Customer: newTicketCount is 0; replyCount is unread staff replies on their tickets.
   */
  support: SupportInboxSignal;
  /** Exclusive tenant membership theme. Null for platform staff and customers. */
  tenant: LoginTenantTheme | null;
}

export interface LoginResponse extends TokenPair {
  user: LoginUserPayload;
}

export type LoginResult = LoginResponse | MfaRequiredResponse;

interface SessionState {
  sessionId: string;
  refreshToken: string;
  expiresAt: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly emailService: BrevoEmailService,
    private readonly userAccountLifecycleValidator: UserAccountLifecycleValidator,
    private readonly authPayloadService: AuthPayloadService,
    @Inject(forwardRef(() => MfaService))
    private readonly mfaService: MfaService,
  ) {}

  async logout(id: number): Promise<{ message: string }> {
    await this.clearUserSession(id);
    return { message: 'Logout successful' };
  }

  async signup(signupDto: SignupDto): Promise<LoginResponse> {
    const [existingUser, hashedPassword, customerRole, gender, district] =
      await Promise.all([
        this.prisma.user.findFirst({
          where: {
            OR: [
              { userId: signupDto.userId },
              ...(signupDto.email ? [{ email: signupDto.email }] : []),
            ],
          },
          select: { userId: true },
        }),
        hashPassword(signupDto.password),
        findOrCreatePlatformCustomerRole(this.prisma),
        signupDto.genderId === undefined
          ? Promise.resolve({ genderId: true as const })
          : this.prisma.gender.findUnique({
              where: { genderId: signupDto.genderId },
              select: { genderId: true },
            }),
        signupDto.districtId === undefined
          ? Promise.resolve({ id: true as const })
          : this.prisma.district.findUnique({
              where: { id: signupDto.districtId },
              select: { id: true },
            }),
      ]);

    if (existingUser) {
      // Generic message avoids account-existence enumeration via signup.
      throw new ConflictException(
        'Unable to create account with the provided details',
      );
    }

    if (!gender) {
      throw new BadRequestException('Invalid gender');
    }

    if (!district) {
      throw new BadRequestException('Invalid district');
    }

    const user = await this.prisma.user.create({
      data: {
        userId: signupDto.userId,
        password: hashedPassword,
        fullname: signupDto.fullname,
        nationalId: signupDto.nationalId,
        email: signupDto.email,
        phone: signupDto.phone,
        genderId: signupDto.genderId,
        districtId: signupDto.districtId,
        userRoles: {
          create: {
            roleId: customerRole.roleId,
            tenantId: null,
          },
        },
      },
      select: { id: true, email: true, fullname: true },
    });

    if (user.email) {
      const emailContent = buildWelcomeEmail({ fullname: user.fullname });
      void this.emailService.send({
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
    }

    return this.completeAuthenticatedResponse(user.id);
  }

  async login(loginDto: LoginDto): Promise<LoginResult> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ userId: loginDto.identity }, { email: loginDto.identity }],
      },
      select: LOGIN_CREDENTIAL_SELECT,
    });

    const passwordMatches =
      user !== null &&
      user.password !== null &&
      (await bcrypt.compare(loginDto.password, user.password));

    if (!user || !passwordMatches) {
      throw appHttpException(
        HttpStatus.UNAUTHORIZED,
        'Invalid credentials',
        APP_ERROR_CODES.INVALID_CREDENTIALS,
      );
    }

    if (user.deletedAt !== null) {
      throw new ForbiddenException(
        'Operation denied: User account has been soft-deleted.',
      );
    }

    this.userAccountLifecycleValidator.assertTenantMemberHasAssignedRoles(user);

    if (
      (await this.mfaService.isMfaRequiredForUser(user)) &&
      !isSystemRootUserByRoleKeys(user.userRoles.map((row) => row.role.key))
    ) {
      return this.mfaService.initiateMfa({
        id: user.id,
        userId: user.userId,
        fullname: user.fullname,
        email: user.email ?? '',
      });
    }

    return this.completeLogin(user.id);
  }

  async completeLogin(id: number): Promise<LoginResponse> {
    return this.completeAuthenticatedResponse(id);
  }

  private async completeAuthenticatedResponse(
    id: number,
  ): Promise<LoginResponse> {
    await this.userAccountLifecycleValidator.assertUserCanAuthenticate(id);
    const [tokens, response] = await Promise.all([
      this.generateTokens(id),
      this.authPayloadService.buildLoginResponse(id),
    ]);
    return { ...response, ...tokens };
  }

  async generateTokens(id: number): Promise<TokenPair> {
    return this.persistSession(id, new Date(Date.now() + REFRESH_TOKEN_TTL_MS));
  }

  /**
   * Access and refresh tokens that are not written onto User.sessionState.
   * Sandbox stores the hash on its own session row so one demo user can
   * hold many visits at once.
   */
  async issueSandboxSession(
    id: number,
    expiresAt: Date,
  ): Promise<TokenPair & { refreshTokenHash: string }> {
    await this.userAccountLifecycleValidator.assertUserCanAuthenticate(id);
    const refreshToken = randomBytes(48).toString('base64url');
    const accessToken = await this.signAccessToken(
      id,
      cappedAccessTtlSeconds(expiresAt),
    );

    return {
      accessToken,
      refreshToken,
      refreshTokenHash: this.hashRefreshToken(refreshToken),
    };
  }

  private async persistSession(
    id: number,
    expiresAt: Date,
  ): Promise<TokenPair> {
    const sessionId = randomUUID();
    const refreshToken = randomBytes(48).toString('base64url');
    const accessToken = await this.signAccessToken(
      id,
      cappedAccessTtlSeconds(expiresAt),
    );

    const sessionState: SessionState = {
      sessionId,
      refreshToken: this.hashRefreshToken(refreshToken),
      expiresAt: expiresAt.toISOString(),
    };

    await this.prisma.user.update({
      where: { id },
      data: { sessionState: sessionState as unknown as Prisma.InputJsonValue },
    });

    return { accessToken, refreshToken };
  }

  async refreshSession(incomingRefreshToken: string): Promise<LoginResponse> {
    const sandboxRefresh =
      await this.refreshSandboxSession(incomingRefreshToken);
    if (sandboxRefresh) {
      return sandboxRefresh;
    }

    const user = await this.findUserByRefreshToken(incomingRefreshToken);

    if (!user) {
      throw appHttpException(
        HttpStatus.UNAUTHORIZED,
        'Invalid refresh session',
        APP_ERROR_CODES.INVALID_REFRESH_SESSION,
      );
    }

    const sessionState = this.parseSessionState(user.sessionState);

    if (
      !sessionState ||
      !this.isRefreshTokenValid(
        incomingRefreshToken,
        sessionState.refreshToken,
      ) ||
      this.isSessionExpired(sessionState.expiresAt)
    ) {
      await this.clearUserSession(user.id);
      throw appHttpException(
        HttpStatus.UNAUTHORIZED,
        'Invalid or expired refresh token',
        APP_ERROR_CODES.INVALID_REFRESH_SESSION,
      );
    }

    await Promise.all([
      this.userAccountLifecycleValidator.assertUserAccountIsNotDeleted(
        user.userId,
      ),
      this.userAccountLifecycleValidator.assertUserCanAuthenticate(user.id),
    ]);

    const nextSessionState: SessionState = {
      ...sessionState,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString(),
    };

    const [accessToken, response] = await Promise.all([
      this.signAccessToken(user.id),
      this.authPayloadService.buildLoginResponse(user.id),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          sessionState: nextSessionState as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);

    // Keep the same refresh token so concurrent tab/interceptor refreshes
    // cannot invalidate each other and look like a dead session.
    return {
      ...response,
      accessToken,
      refreshToken: incomingRefreshToken,
    };
  }

  /**
   * Refresh one sandbox visit. Returns null when the token is not a sandbox
   * session so the normal single-session path can run. An expired visit is
   * revoked here and does not affect the demo user or any other visit.
   */
  private async refreshSandboxSession(
    incomingRefreshToken: string,
  ): Promise<LoginResponse | null> {
    const session = await this.prisma.demoSession.findUnique({
      where: {
        refreshTokenHash: this.hashRefreshToken(incomingRefreshToken),
      },
      select: { id: true, userId: true, expiresAt: true },
    });

    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.demoSession.delete({ where: { id: session.id } });
      throw appHttpException(
        HttpStatus.UNAUTHORIZED,
        'Invalid or expired refresh token',
        APP_ERROR_CODES.INVALID_REFRESH_SESSION,
      );
    }

    const account = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, userId: true },
    });

    if (!account) {
      await this.prisma.demoSession.delete({ where: { id: session.id } });
      throw appHttpException(
        HttpStatus.UNAUTHORIZED,
        'Invalid or expired refresh token',
        APP_ERROR_CODES.INVALID_REFRESH_SESSION,
      );
    }

    await Promise.all([
      this.userAccountLifecycleValidator.assertUserAccountIsNotDeleted(
        account.userId,
      ),
      this.userAccountLifecycleValidator.assertUserCanAuthenticate(account.id),
      this.prisma.demoSession.update({
        where: { id: session.id },
        data: { lastActivityAt: new Date() },
      }),
    ]);

    const [accessToken, response] = await Promise.all([
      this.signAccessToken(
        account.id,
        cappedAccessTtlSeconds(session.expiresAt),
      ),
      this.authPayloadService.buildLoginResponse(account.id),
    ]);

    return {
      ...response,
      accessToken,
      refreshToken: incomingRefreshToken,
    };
  }

  private async signAccessToken(
    id: number,
    expiresIn?: number,
  ): Promise<string> {
    return this.jwtService.signAsync(buildSessionJwtClaims(id), {
      expiresIn: (expiresIn ??
        resolveJwtExpiresIn(
          process.env.JWT_EXPIRATION_TIME,
        )) as JwtSignOptions['expiresIn'],
      subject: String(id),
    });
  }

  private async findUserByRefreshToken(incomingRefreshToken: string): Promise<{
    id: number;
    userId: string;
    sessionState: Prisma.JsonValue | null;
  } | null> {
    // Lookup is keyed by the token hash so callers cannot nominate another user's session.
    return this.prisma.user.findFirst({
      where: {
        sessionState: {
          path: ['refreshToken'],
          equals: this.hashRefreshToken(incomingRefreshToken),
        },
      },
      select: { id: true, userId: true, sessionState: true },
    });
  }

  private parseSessionState(
    value: Prisma.JsonValue | null,
  ): SessionState | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, unknown>;
    const { sessionId, refreshToken, expiresAt } = record;

    if (
      typeof sessionId !== 'string' ||
      typeof refreshToken !== 'string' ||
      typeof expiresAt !== 'string'
    ) {
      return null;
    }

    return { sessionId, refreshToken, expiresAt };
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private isRefreshTokenValid(plainToken: string, storedHash: string): boolean {
    const incomingHash = this.hashRefreshToken(plainToken);
    const incomingBuffer = Buffer.from(incomingHash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');

    if (incomingBuffer.length !== storedBuffer.length) {
      return false;
    }

    return timingSafeEqual(incomingBuffer, storedBuffer);
  }

  private isSessionExpired(expiresAt: string): boolean {
    const expiration = new Date(expiresAt);
    return (
      Number.isNaN(expiration.getTime()) || expiration.getTime() <= Date.now()
    );
  }

  private async clearUserSession(id: number): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { sessionState: Prisma.DbNull },
    });
  }
}
