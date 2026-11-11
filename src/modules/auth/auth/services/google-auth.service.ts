import {
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { BrevoEmailService } from '../../../../core/email/services/brevo-email.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import type { GoogleOAuthProfile } from '../../shared/strategies/google.strategy';
import { findOrCreatePlatformCustomerRole } from '../../shared/utils/ensure-platform-role.util';
import { isSystemRootUserByRoleKeys } from '../../shared/utils/system-root-user.util';
import { MfaService } from '../../mfa/services/mfa.service';
import { buildWelcomeEmail } from '../templates/welcome.email';
import {
  AuthService,
  LoginResponse,
  type LoginResult,
} from './auth.service';

const GOOGLE_OAUTH_USER_SELECT = {
  id: true,
  userId: true,
  fullname: true,
  email: true,
  isMfaEnabled: true,
  deletedAt: true,
  userRoles: {
    select: {
      role: { select: { key: true } },
    },
  },
} as const;

const GOOGLE_PROVIDER = 'google' as const;
const OAUTH_NATIONAL_ID_PLACEHOLDER = 'OAUTH-PENDING';
const OAUTH_USERNAME_MAX_LENGTH = 100;
const OAUTH_USERNAME_SUFFIX_LENGTH = 4;
const OAUTH_USERNAME_UNIQUE_ATTEMPTS = 10;

@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly emailService: BrevoEmailService,
    @Inject(forwardRef(() => MfaService))
    private readonly mfaService: MfaService,
  ) {}

  async validateOrCreateOAuthUser(
    profile: GoogleOAuthProfile,
  ): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: profile.email },
      select: GOOGLE_OAUTH_USER_SELECT,
    });

    if (user) {
      return this.handleExistingUser(user, profile);
    }

    return this.createOAuthUser(profile);
  }

  private async handleExistingUser(
    user: {
      id: number;
      userId: string;
      fullname: string;
      email: string | null;
      isMfaEnabled: boolean;
      deletedAt: Date | null;
      userRoles: Array<{ role: { key: string } }>;
    },
    profile: GoogleOAuthProfile,
  ): Promise<LoginResult> {
    if (user.deletedAt !== null) {
      throw new ForbiddenException(
        'Operation denied: User account has been soft-deleted.',
      );
    }

    const existingGoogleAccount = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: GOOGLE_PROVIDER,
          providerAccountId: profile.googleId,
        },
      },
    });

    if (
      existingGoogleAccount &&
      existingGoogleAccount.userId !== user.id
    ) {
      throw new ConflictException(
        'This Google account is already linked to another user',
      );
    }

    if (!existingGoogleAccount) {
      await this.prisma.account.create({
        data: {
          userId: user.id,
          provider: GOOGLE_PROVIDER,
          providerAccountId: profile.googleId,
        },
      });
    }

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

    return this.completeAuthenticatedResponse(user.id);
  }

  private async createOAuthUser(
    profile: GoogleOAuthProfile,
  ): Promise<LoginResponse> {
    const userId = await this.resolveUniqueOAuthUserId(profile.fullname);

    const customerRole = await findOrCreatePlatformCustomerRole(this.prisma);

    const user = await this.prisma.user.create({
      data: {
        userId,
        password: null,
        fullname: profile.fullname,
        email: profile.email,
        nationalId: OAUTH_NATIONAL_ID_PLACEHOLDER,
        avatarUrl: profile.avatarUrl,
        accounts: {
          create: {
            provider: GOOGLE_PROVIDER,
            providerAccountId: profile.googleId,
          },
        },
        userRoles: {
          create: {
            roleId: customerRole.roleId,
            tenantId: null,
          },
        },
      },
      select: { id: true, fullname: true },
    });

    const emailContent = buildWelcomeEmail({ fullname: user.fullname });
    void this.emailService.send({
      to: profile.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    return this.completeAuthenticatedResponse(user.id);
  }

  private async completeAuthenticatedResponse(
    id: number,
  ): Promise<LoginResponse> {
    return this.authService.completeLogin(id);
  }

  private async resolveUniqueOAuthUserId(fullname: string): Promise<string> {
    const maxBaseLength =
      OAUTH_USERNAME_MAX_LENGTH - OAUTH_USERNAME_SUFFIX_LENGTH;
    const base = this.buildUsernameBase(fullname).slice(0, maxBaseLength);

    return this.resolveUniqueOAuthUserIdWithBase(base);
  }

  private async resolveUniqueOAuthUserIdWithBase(
    base: string,
  ): Promise<string> {
    for (let attempt = 0; attempt < OAUTH_USERNAME_UNIQUE_ATTEMPTS; attempt++) {
      const suffix = randomInt(1000, 10000).toString();
      const candidate = `${base}${suffix}`.slice(0, OAUTH_USERNAME_MAX_LENGTH);

      const existingUser = await this.prisma.user.findUnique({
        where: { userId: candidate },
        select: { userId: true },
      });

      if (!existingUser) {
        return candidate;
      }
    }

    const fallbackSuffix = randomInt(100000, 1000000).toString();
    return `${base}${fallbackSuffix}`.slice(0, OAUTH_USERNAME_MAX_LENGTH);
  }

  private buildUsernameBase(fullname: string): string {
    const compactName = fullname
      .trim()
      .replace(/\s+/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '');

    if (compactName.length >= 2) {
      return compactName;
    }

    return 'user';
  }
}
