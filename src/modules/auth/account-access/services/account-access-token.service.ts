import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../../core/database/prisma.service';
import { UserAccountLifecycleValidator } from '../../../users/shared/validators/user-account-lifecycle.validator';
import {
  ACCOUNT_ACCESS_TOKEN_PURPOSE,
  ACCOUNT_ACCESS_TOKEN_TTL,
} from '../constants/account-access-token.constant';

interface AccountAccessTokenPayload {
  sub: string;
  purpose: typeof ACCOUNT_ACCESS_TOKEN_PURPOSE;
  /** credentialsVersion at issuance — must match DB for the link to remain valid */
  cv: number;
}

export interface AccountAccessLinkContext {
  userId: string;
  fullname: string;
}

/**
 * Signs and validates email-link tokens for admin-driven account setup and recovery.
 * Not used for login sessions or self-service password-reset PINs.
 */
@Injectable()
export class AccountAccessTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly userAccountLifecycleValidator: UserAccountLifecycleValidator,
  ) {}

  async sign(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { id: true, credentialsVersion: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired access link');
    }

    const payload: AccountAccessTokenPayload = {
      sub: String(user.id),
      purpose: ACCOUNT_ACCESS_TOKEN_PURPOSE,
      cv: user.credentialsVersion,
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: ACCOUNT_ACCESS_TOKEN_TTL,
    });
  }

  async assertValidLink(
    userId: string,
    token: string,
  ): Promise<AccountAccessLinkContext> {
    const user =
      await this.userAccountLifecycleValidator.assertUserAccountIsNotDeleted(
        userId,
      );

    const payload = await this.verifyTokenSignature(user.id, token);

    // Re-read after verify so a password/credentials bump cannot race the link.
    // `userId` is the unique login handle (not a relation key).
    const current = await this.prisma.user.findUnique({
      where: { userId: user.userId },
      select: { credentialsVersion: true },
    });

    if (!current || payload.cv !== current.credentialsVersion) {
      throw new UnauthorizedException('Invalid or expired access link');
    }

    return {
      userId: user.userId,
      fullname: user.fullname,
    };
  }

  private async verifyTokenSignature(
    id: number,
    token: string,
  ): Promise<AccountAccessTokenPayload> {
    try {
      const payload =
        await this.jwtService.verifyAsync<AccountAccessTokenPayload>(token);

      if (payload.sub !== String(id)) {
        throw new UnauthorizedException('Invalid or expired access link');
      }

      if (payload.purpose !== ACCOUNT_ACCESS_TOKEN_PURPOSE) {
        throw new UnauthorizedException('Invalid or expired access link');
      }

      if (typeof payload.cv !== 'number') {
        throw new UnauthorizedException('Invalid or expired access link');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired access link');
    }
  }
}
