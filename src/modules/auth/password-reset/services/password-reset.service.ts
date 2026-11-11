import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BrevoEmailService } from '../../../../core/email/services/brevo-email.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import { UserAccountLifecycleValidator } from '../../../users/shared/validators/user-account-lifecycle.validator';
import { isSystemRootIdentity } from '../../shared/utils/system-root-user.util';
import { hashPassword } from '../../shared/utils/hash-password.util';
import { sendPasswordChangedNotification } from '../../shared/utils/send-password-changed-notification.util';
import { PasswordResetConfirmDto } from '../dto/password-reset-confirm.dto';
import { PasswordResetRequestDto } from '../dto/password-reset-request.dto';
import { PasswordResetVerifyDto } from '../dto/password-reset-verify.dto';
import { buildPasswordResetPinEmail } from '../templates/password-reset-pin.email';
import { normalizeIdentity } from '../utils/normalize-identity.util';
import {
  createResetPinExpiryDate,
  getResetPinTtlMinutes,
  getResetPinTtlSeconds,
  isResetPinExpired,
} from '../utils/reset-pin-expiry.util';
import {
  generateResetPin,
  hashResetPin,
  isResetPinMatch,
} from '../utils/reset-pin.util';

const GENERIC_RESET_MESSAGE =
  'If an account matches that identity, a verification code has been sent to its registered email.';

export interface PasswordResetRequestResponse {
  message: string;
  identity: string;
  expiresInSeconds: number;
}

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: BrevoEmailService,
    private readonly userAccountLifecycleValidator: UserAccountLifecycleValidator,
  ) {}

  async requestReset(
    dto: PasswordResetRequestDto,
  ): Promise<PasswordResetRequestResponse> {
    const identity = normalizeIdentity(dto.identity);
    const user = await this.findUserByIdentity(identity);

    // Same response whether the account exists or not (anti-enumeration).
    const response: PasswordResetRequestResponse = {
      message: GENERIC_RESET_MESSAGE,
      identity,
      expiresInSeconds: getResetPinTtlSeconds(),
    };

    if (!user?.email) {
      return response;
    }

    if (!(await this.isUserEligibleForPasswordReset(user.userId))) {
      return response;
    }

    const pin = generateResetPin();
    const hashedPin = await hashResetPin(pin);
    const emailContent = buildPasswordResetPinEmail({
      fullname: user.fullname,
      pin,
      expiresInMinutes: getResetPinTtlMinutes(),
    });

    await this.prisma.user.update({
      where: { userId: user.userId },
      data: {
        passwordResetPin: hashedPin,
        passwordResetExpires: createResetPinExpiryDate(),
        passwordResetCount: { increment: 1 },
      },
    });

    await this.emailService.send({
      to: user.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    return response;
  }

  async verifyPin(dto: PasswordResetVerifyDto): Promise<{ message: string }> {
    await this.assertValidResetPin(dto.identity, dto.pin);

    return {
      message: 'Verification code is valid. You may set a new password.',
    };
  }

  async confirmPassword(
    dto: PasswordResetConfirmDto,
  ): Promise<{ message: string }> {
    const user = await this.assertValidResetPin(dto.identity, dto.pin);

    if (isSystemRootIdentity(user.userId)) {
      throw new ForbiddenException(
        'The system master administrator password cannot be changed from the app',
      );
    }

    const hashedPassword = await hashPassword(dto.newPassword);

    await this.prisma.user.update({
      where: { userId: user.userId },
      data: {
        password: hashedPassword,
        passwordResetPin: null,
        passwordResetExpires: null,
        sessionState: Prisma.DbNull,
        // Invalidate outstanding account-access invite/recovery JWTs
        credentialsVersion: { increment: 1 },
      },
    });

    if (user.email) {
      sendPasswordChangedNotification(this.emailService, {
        email: user.email,
        fullname: user.fullname,
      });
    }

    return {
      message:
        'Password updated successfully. Please log in with your new credentials.',
    };
  }

  private async assertValidResetPin(identity: string, pin: string) {
    const user = await this.findUserByIdentity(normalizeIdentity(identity));

    if (!user) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.userAccountLifecycleValidator.assertUserAccountIsNotDeleted(
      user.userId,
    );

    if (!user.passwordResetPin || !user.passwordResetExpires) {
      throw new BadRequestException('Invalid verification code');
    }

    if (isResetPinExpired(user.passwordResetExpires)) {
      throw new GoneException('Verification code has expired');
    }

    const pinMatches = await isResetPinMatch(pin, user.passwordResetPin);
    if (!pinMatches) {
      throw new BadRequestException('Invalid verification code');
    }

    return user;
  }

  private async isUserEligibleForPasswordReset(
    userId: string,
  ): Promise<boolean> {
    if (isSystemRootIdentity(userId)) {
      return false;
    }

    try {
      await this.userAccountLifecycleValidator.assertUserAccountIsNotDeleted(
        userId,
      );
      return true;
    } catch {
      return false;
    }
  }

  private async findUserByIdentity(identity: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [
          { userId: identity },
          { email: { equals: identity, mode: 'insensitive' } },
        ],
      },
      select: {
        userId: true,
        fullname: true,
        email: true,
        passwordResetPin: true,
        passwordResetExpires: true,
      },
    });
  }
}
