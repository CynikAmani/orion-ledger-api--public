import { Injectable } from '@nestjs/common';
import type { AuditContext } from '../../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../../core/database/prisma.service';
import { MFA_SETTING_KEY } from '../constants/mfa-settings.constant';

export interface MfaSettingResponse {
  mfaEnabled: boolean;
}

export interface UpdateMfaSettingResponse {
  success: true;
  mfaEnabled: boolean;
}

@Injectable()
export class MfaSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
  ) {}

  async getMfaSetting(): Promise<MfaSettingResponse> {
    return {
      mfaEnabled: await this.isMfaEnabled(),
    };
  }

  async updateMfaSetting(
    enabled: boolean,
    auditContext: AuditContext,
  ): Promise<UpdateMfaSettingResponse> {
    const value = enabled ? 'true' : 'false';

    await this.prisma.systemSetting.upsert({
      where: { key: MFA_SETTING_KEY },
      update: { value },
      create: { key: MFA_SETTING_KEY, value },
    });

    this.auditEmitter.emit({
      ...auditContext,
      module: 'SYSTEM_CONFIGURATIONS',
      action: 'MFA_SETTING_UPDATED',
      targetId: MFA_SETTING_KEY,
      targetType: 'MfaSetting',
      payload: { enabled },
    });

    return {
      success: true,
      mfaEnabled: enabled,
    };
  }

  async isMfaEnabled(): Promise<boolean> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: MFA_SETTING_KEY },
      select: { value: true },
    });

    return setting?.value === 'true';
  }
}
