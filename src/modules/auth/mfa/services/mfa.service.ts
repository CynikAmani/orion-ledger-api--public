import {
  BadRequestException,
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BrevoEmailService } from '../../../../core/email/services/brevo-email.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import { UserAccountLifecycleValidator } from '../../../users/shared/validators/user-account-lifecycle.validator';
import { MfaSettingsService } from '../../../system-configurations/platform/mfa-settings/services/mfa-settings.service';
import type { LoginResponse } from '../../auth/services/auth.service';
import { AuthService } from '../../auth/services/auth.service';
import {
  MFA_MAX_RESEND_COUNT,
  MFA_MAX_VERIFY_ATTEMPTS,
  MFA_PIN_TTL_MS,
  MFA_RESEND_COOLDOWN_MS,
} from '../constants/mfa.constant';
import { ResendMfaDto } from '../dto/resend-mfa.dto';
import { VerifyMfaDto } from '../dto/verify-mfa.dto';
import { MfaTokenService } from './mfa-token.service';
import { buildMfaPinEmail } from '../templates/mfa-pin.email';
import { generateMfaPin, hashMfaPin, isMfaPinMatch } from '../utils/mfa-pin.util';
import {
  buildSessionStateWithMfa,
  createMfaSessionState,
  isMfaSessionExpired,
  parseMfaSessionState,
  secondsSinceLastMfaSend,
} from '../utils/mfa-session-state.util';

export interface MfaRequiredResponse {
  status: 'mfa_required';
  mfaToken: string;
}

export interface ResendMfaResponse {
  message: string;
}

interface MfaEligibleUser {
  id: number;
  userId: string;
  fullname: string;
  email: string;
}

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: BrevoEmailService,
    private readonly mfaTokenService: MfaTokenService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    private readonly userAccountLifecycleValidator: UserAccountLifecycleValidator,
    private readonly mfaSettingsService: MfaSettingsService,
  ) {}

  async isEnabled(): Promise<boolean> {
    return this.mfaSettingsService.isMfaEnabled();
  }

  async isMfaRequiredForUser(user: {
    isMfaEnabled: boolean;
  }): Promise<boolean> {
    const systemMfaEnabled = await this.mfaSettingsService.isMfaEnabled();
    return systemMfaEnabled || user.isMfaEnabled === true;
  }

  async initiateMfa(user: MfaEligibleUser): Promise<MfaRequiredResponse> {
    if (!user.email) {
      throw new BadRequestException(
        'Multi-factor authentication is enabled, but this account has no registered email.',
      );
    }

    const pin = generateMfaPin();
    const mfaState = createMfaSessionState(pin);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        sessionState: buildSessionStateWithMfa(mfaState),
      },
    });

    await this.sendMfaPinEmail(user, pin);

    const mfaToken = await this.mfaTokenService.sign(user.id);

    return {
      status: 'mfa_required',
      mfaToken,
    };
  }

  async verifyMfa(dto: VerifyMfaDto): Promise<LoginResponse> {
    const id = await this.mfaTokenService.verify(dto.mfaToken);

    await this.userAccountLifecycleValidator.assertUserAccountIsNotDeletedById(
      id,
    );

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { sessionState: true },
    });

    if (!user) {
      throw new BadRequestException(
        'MFA session expired or locked due to too many failed attempts',
      );
    }

    const mfaState = parseMfaSessionState(user.sessionState);

    if (
      !mfaState ||
      isMfaSessionExpired(mfaState.expiresAt) ||
      Number(mfaState.attempts) >= MFA_MAX_VERIFY_ATTEMPTS
    ) {
      await this.clearMfaSessionState(id);
      throw new BadRequestException(
        'MFA session expired or locked due to too many failed attempts',
      );
    }

    const updatedAttempts = Number(mfaState.attempts) + 1;

    if (!isMfaPinMatch(dto.pin, mfaState.hashedPin)) {
      await this.prisma.user.update({
        where: { id },
        data: {
          sessionState: buildSessionStateWithMfa({
            ...mfaState,
            attempts: updatedAttempts,
          }),
        },
      });

      throw new BadRequestException('Invalid PIN');
    }

    await this.clearMfaSessionState(id);

    return this.authService.completeLogin(id);
  }

  async resendMfa(dto: ResendMfaDto): Promise<ResendMfaResponse> {
    const id = await this.mfaTokenService.verify(dto.mfaToken);

    const userRecord =
      await this.userAccountLifecycleValidator.assertUserAccountIsNotDeletedById(
        id,
      );

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        fullname: true,
        email: true,
        sessionState: true,
      },
    });

    if (!user?.email) {
      throw new BadRequestException(
        'MFA session expired or locked due to too many failed attempts',
      );
    }

    const mfaState = parseMfaSessionState(user.sessionState);

    if (!mfaState || isMfaSessionExpired(mfaState.expiresAt)) {
      await this.clearMfaSessionState(id);
      throw new BadRequestException(
        'MFA session expired or locked due to too many failed attempts',
      );
    }

    if (Number(mfaState.resendCount) >= MFA_MAX_RESEND_COUNT) {
      throw new HttpException(
        'Maximum resend attempts reached. Please restart sign-in.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (secondsSinceLastMfaSend(mfaState.lastSentAt) < MFA_RESEND_COOLDOWN_MS / 1000) {
      throw new HttpException(
        'Please wait 60 seconds before requesting a new PIN.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const pin = generateMfaPin();
    const now = Date.now();
    const updatedMfaState = {
      hashedPin: hashMfaPin(pin),
      expiresAt: now + MFA_PIN_TTL_MS,
      resendCount: Number(mfaState.resendCount) + 1,
      lastSentAt: now,
      attempts: 0,
    };

    await this.prisma.user.update({
      where: { id },
      data: {
        sessionState: buildSessionStateWithMfa(updatedMfaState),
      },
    });

    await this.sendMfaPinEmail(
      {
        id,
        userId: userRecord.userId,
        fullname: user.fullname,
        email: user.email,
      },
      pin,
    );

    return {
      message: 'A new MFA PIN has been sent to your email.',
    };
  }

  private async clearMfaSessionState(id: number): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { sessionState: Prisma.DbNull },
    });
  }

  private async sendMfaPinEmail(
    user: MfaEligibleUser,
    pin: string,
  ): Promise<void> {
    const emailContent = buildMfaPinEmail({
      fullname: user.fullname,
      pin,
    });

    await this.emailService.send({
      to: user.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
  }
}
