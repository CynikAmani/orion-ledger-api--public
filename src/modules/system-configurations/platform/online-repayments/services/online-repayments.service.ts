import { Injectable } from '@nestjs/common';
import type { AuditContext } from '../../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../../core/database/prisma.service';
import { ONLINE_REPAYMENTS_SETTING_KEY } from '../constants/online-repayments.constant';

export interface OnlineRepaymentsSettingResponse {
  onlineRepaymentsEnabled: boolean;
}

export interface UpdateOnlineRepaymentsSettingResponse {
  success: true;
  onlineRepaymentsEnabled: boolean;
}

@Injectable()
export class OnlineRepaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
  ) {}

  async getOnlineRepaymentsSetting(): Promise<OnlineRepaymentsSettingResponse> {
    return {
      onlineRepaymentsEnabled: await this.isOnlineRepaymentsEnabled(),
    };
  }

  async updateOnlineRepaymentsSetting(
    enabled: boolean,
    auditContext: AuditContext,
  ): Promise<UpdateOnlineRepaymentsSettingResponse> {
    const value = enabled ? 'true' : 'false';

    await this.prisma.systemSetting.upsert({
      where: { key: ONLINE_REPAYMENTS_SETTING_KEY },
      update: { value },
      create: { key: ONLINE_REPAYMENTS_SETTING_KEY, value },
    });

    this.auditEmitter.emit({
      ...auditContext,
      module: 'SYSTEM_CONFIGURATIONS',
      action: 'ONLINE_REPAYMENTS_SETTING_UPDATED',
      targetId: ONLINE_REPAYMENTS_SETTING_KEY,
      targetType: 'OnlineRepaymentsSetting',
      payload: { enabled },
    });

    return {
      success: true,
      onlineRepaymentsEnabled: enabled,
    };
  }

  async isOnlineRepaymentsEnabled(): Promise<boolean> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: ONLINE_REPAYMENTS_SETTING_KEY },
      select: { value: true },
    });

    return setting?.value === 'true';
  }
}
