import { Injectable } from '@nestjs/common';
import type { AuditContext } from '../../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../../core/database/prisma.service';
import { INCLUDE_DEMO_TENANTS_SETTING_KEY } from '../constants/include-demo-tenants.constant';

export interface IncludeDemoTenantsSettingResponse {
  includeDemoTenants: boolean;
}

export interface UpdateIncludeDemoTenantsSettingResponse {
  success: true;
  includeDemoTenants: boolean;
}

@Injectable()
export class IncludeDemoTenantsSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
  ) {}

  async getSetting(): Promise<IncludeDemoTenantsSettingResponse> {
    return {
      includeDemoTenants: await this.isEnabled(),
    };
  }

  async updateSetting(
    enabled: boolean,
    auditContext: AuditContext,
  ): Promise<UpdateIncludeDemoTenantsSettingResponse> {
    const value = enabled ? 'true' : 'false';

    await this.prisma.systemSetting.upsert({
      where: { key: INCLUDE_DEMO_TENANTS_SETTING_KEY },
      update: { value },
      create: { key: INCLUDE_DEMO_TENANTS_SETTING_KEY, value },
    });

    this.auditEmitter.emit({
      ...auditContext,
      module: 'SYSTEM_CONFIGURATIONS',
      action: 'INCLUDE_DEMO_TENANTS_SETTING_UPDATED',
      targetId: INCLUDE_DEMO_TENANTS_SETTING_KEY,
      targetType: 'IncludeDemoTenantsSetting',
      payload: { enabled },
    });

    return {
      success: true,
      includeDemoTenants: enabled,
    };
  }

  /** When true, applicant catalog / customer brand resolve may include demo tenants. */
  async isEnabled(): Promise<boolean> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: INCLUDE_DEMO_TENANTS_SETTING_KEY },
      select: { value: true },
    });

    return setting?.value === 'true';
  }
}
