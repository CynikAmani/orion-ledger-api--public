import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BrevoEmailService } from '../../../../core/email/services/brevo-email.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import { isSystemRootIdentity } from '../../shared/utils/system-root-user.util';
import { hashPassword } from '../../shared/utils/hash-password.util';
import { sendPasswordChangedNotification } from '../../shared/utils/send-password-changed-notification.util';
import { SetAccountAccessPasswordDto } from '../dto/set-account-access-password.dto';
import { AccountAccessTokenService } from './account-access-token.service';

@Injectable()
export class AccountAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: BrevoEmailService,
    private readonly accountAccessTokenService: AccountAccessTokenService,
  ) {}

  async setPassword(
    dto: SetAccountAccessPasswordDto,
  ): Promise<{ message: string }> {
    if (isSystemRootIdentity(dto.userId)) {
      throw new ForbiddenException(
        'The system master administrator password cannot be changed from the app',
      );
    }

    const user = await this.accountAccessTokenService.assertValidLink(
      dto.userId,
      dto.token,
    );

    const hashedPassword = await hashPassword(dto.newPassword);

    // Increment credentialsVersion so the invite JWT cannot be reused within TTL.
    await this.prisma.user.update({
      where: { userId: dto.userId },
      data: {
        password: hashedPassword,
        sessionState: Prisma.DbNull,
        passwordResetPin: null,
        passwordResetExpires: null,
        credentialsVersion: { increment: 1 },
      },
    });

    const record = await this.prisma.user.findUnique({
      where: { userId: dto.userId },
      select: { email: true },
    });

    if (record?.email) {
      sendPasswordChangedNotification(this.emailService, {
        email: record.email,
        fullname: user.fullname,
      });
    }

    return {
      message:
        'Password set successfully. You may now sign in with your new credentials.',
    };
  }
}
