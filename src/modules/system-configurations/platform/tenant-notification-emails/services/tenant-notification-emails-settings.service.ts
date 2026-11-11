import { Injectable } from '@nestjs/common';
import type { AuditContext } from '../../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../../core/database/prisma.service';
import { TENANT_NOTIFICATION_EMAILS_SETTING_KEY } from '../constants/tenant-notification-emails.constant';

export interface TenantNotificationEmailsSettingResponse {
  tenantNotificationEmailsEnabled: boolean;
}

export interface UpdateTenantNotificationEmailsSettingResponse {
  success: true;
  tenantNotificationEmailsEnabled: boolean;
}

@Injectable()
export class TenantNotificationEmailsSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
  ) {}

  async getSetting(): Promise<TenantNotificationEmailsSettingResponse> {
    return {
      tenantNotificationEmailsEnabled: await this.isEnabled(),
    };
  }

  async updateSetting(
    enabled: boolean,
    auditContext: AuditContext,
  ): Promise<UpdateTenantNotificationEmailsSettingResponse> {
    const value = enabled ? 'true' : 'false';

    await this.prisma.systemSetting.upsert({
      where: { key: TENANT_NOTIFICATION_EMAILS_SETTING_KEY },
      update: { value },
      create: { key: TENANT_NOTIFICATION_EMAILS_SETTING_KEY, value },
    });

    this.auditEmitter.emit({
      ...auditContext,
      module: 'SYSTEM_CONFIGURATIONS',
      action: 'TENANT_NOTIFICATION_EMAILS_SETTING_UPDATED',
      targetId: TENANT_NOTIFICATION_EMAILS_SETTING_KEY,
      targetType: 'TenantNotificationEmailsSetting',
      payload: { enabled },
    });

    return {
      success: true,
      tenantNotificationEmailsEnabled: enabled,
    };
  }

  /**
   * When true, tenant-scoped dispatcher emails fire and tenants may manage
   * notification role mappings. When false, tenant staff still get in-app alerts.
   */
  async isEnabled(): Promise<boolean> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: TENANT_NOTIFICATION_EMAILS_SETTING_KEY },
      select: { value: true },
    });

    return setting?.value === 'true';
  }
}
