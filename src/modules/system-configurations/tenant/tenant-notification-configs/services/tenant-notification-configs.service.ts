import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuditContext } from '../../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../../core/database/prisma.service';
import {
  DEFAULT_TENANT_NOTIFICATION_CONFIGS,
  TENANT_NOTIFICATION_ACTION_KEY_SET,
} from '../../../../../core/notifications/constants/notification-action-keys.constant';
import { TenantNotificationEmailsSettingsService } from '../../../platform/tenant-notification-emails/services/tenant-notification-emails-settings.service';
import type { SyncNotificationConfigItemDto } from '../../../platform/notification-configs/dto/sync-notification-configs.dto';
import type {
  NotificationConfigListItem,
  NotificationConfigRoleOption,
} from '../../../platform/notification-configs/services/notification-configs.service';

@Injectable()
export class TenantNotificationConfigsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
    private readonly tenantNotificationEmailsSettings: TenantNotificationEmailsSettingsService,
  ) {}

  /** Caller-tenant roles only — for notification config role pickers. */
  async listRoles(tenantId: string): Promise<NotificationConfigRoleOption[]> {
    await this.assertTenantEmailsEnabled();

    const roles = await this.prisma.role.findMany({
      where: { tenantId },
      select: {
        roleId: true,
        key: true,
        name: true,
        description: true,
      },
      orderBy: [{ name: 'asc' }, { key: 'asc' }],
    });

    return roles.map((role) => ({
      roleId: role.roleId,
      key: role.key,
      name: role.name,
      description: role.description,
    }));
  }

  async findAll(tenantId: string): Promise<NotificationConfigListItem[]> {
    await this.assertTenantEmailsEnabled();
    await this.ensureCatalog(tenantId);

    const configs = await this.prisma.notificationConfig.findMany({
      where: { tenantId },
      select: {
        actionKey: true,
        description: true,
        roles: {
          select: {
            roleId: true,
            role: {
              select: {
                roleId: true,
                key: true,
                name: true,
                tenantId: true,
              },
            },
          },
          orderBy: { roleId: 'asc' },
        },
      },
      orderBy: { actionKey: 'asc' },
    });

    return configs.map((config) => {
      const tenantRoles = config.roles.filter(
        (entry) => entry.role.tenantId === tenantId,
      );
      return {
        actionKey: config.actionKey,
        description: config.description,
        assignedRoleIds: tenantRoles.map((entry) => entry.roleId),
        assignedRoles: tenantRoles.map((entry) => ({
          roleId: entry.role.roleId,
          key: entry.role.key,
          name: entry.role.name,
        })),
      };
    });
  }

  async sync(
    tenantId: string,
    items: SyncNotificationConfigItemDto[],
    auditContext: AuditContext,
  ): Promise<NotificationConfigListItem[]> {
    await this.assertTenantEmailsEnabled();

    if (items.length === 0) {
      throw new BadRequestException(
        'At least one notification config is required',
      );
    }

    await this.ensureCatalog(tenantId);

    const actionKeys = items.map((item) => item.actionKey);
    const uniqueActionKeys = new Set(actionKeys);
    if (uniqueActionKeys.size !== actionKeys.length) {
      throw new BadRequestException('Duplicate actionKey values are not allowed');
    }

    for (const actionKey of actionKeys) {
      if (!TENANT_NOTIFICATION_ACTION_KEY_SET.has(actionKey)) {
        throw new BadRequestException(
          `Unknown or non-tenant notification action key: ${actionKey}`,
        );
      }
    }

    const existingConfigs = await this.prisma.notificationConfig.findMany({
      where: { tenantId, actionKey: { in: actionKeys } },
      select: { configId: true, actionKey: true },
    });

    if (existingConfigs.length !== actionKeys.length) {
      const existingKeys = new Set(
        existingConfigs.map((config) => config.actionKey),
      );
      const missing = actionKeys.filter((key) => !existingKeys.has(key));
      throw new NotFoundException(
        `Unknown notification action key(s): ${missing.join(', ')}`,
      );
    }

    const allRoleIds = [...new Set(items.flatMap((item) => item.roleIds))];
    if (allRoleIds.length > 0) {
      const tenantRoles = await this.prisma.role.findMany({
        where: { roleId: { in: allRoleIds }, tenantId },
        select: { roleId: true },
      });

      if (tenantRoles.length !== allRoleIds.length) {
        throw new BadRequestException(
          'One or more role IDs are missing or do not belong to this tenant',
        );
      }
    }

    const configByActionKey = new Map(
      existingConfigs.map((config) => [config.actionKey, config.configId]),
    );

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const configId = configByActionKey.get(item.actionKey);
        if (configId === undefined) {
          continue;
        }

        await tx.notificationConfigRole.deleteMany({
          where: { configId },
        });

        if (item.roleIds.length > 0) {
          await tx.notificationConfigRole.createMany({
            data: item.roleIds.map((roleId) => ({ configId, roleId })),
          });
        }
      }
    });

    this.auditEmitter.emit({
      ...auditContext,
      module: 'SYSTEM_CONFIGURATIONS',
      action: 'TENANT_NOTIFICATION_CONFIGS_SYNCED',
      tenantId,
      targetType: 'NotificationConfig',
      payload: {
        scope: 'tenant',
        tenantId,
        configs: items.map((item) => ({
          actionKey: item.actionKey,
          roleIds: item.roleIds,
        })),
      },
    });

    return this.findAll(tenantId);
  }

  private async assertTenantEmailsEnabled(): Promise<void> {
    const enabled = await this.tenantNotificationEmailsSettings.isEnabled();
    if (!enabled) {
      throw new ForbiddenException(
        'Tenant notification configuration is disabled by the platform',
      );
    }
  }

  private async ensureCatalog(tenantId: string): Promise<void> {
    const tenantKeys = DEFAULT_TENANT_NOTIFICATION_CONFIGS.map(
      (row) => row.actionKey,
    );

    await this.prisma.notificationConfig.deleteMany({
      where: {
        tenantId,
        actionKey: { notIn: [...tenantKeys] },
      },
    });

    const existing = await this.prisma.notificationConfig.findMany({
      where: { tenantId },
      select: { actionKey: true },
    });
    const existingKeys = new Set(existing.map((row) => row.actionKey));
    const missing = DEFAULT_TENANT_NOTIFICATION_CONFIGS.filter(
      (row) => !existingKeys.has(row.actionKey),
    );

    if (missing.length > 0) {
      await this.prisma.notificationConfig.createMany({
        data: missing.map((config) => ({
          tenantId,
          actionKey: config.actionKey,
          description: config.description,
        })),
      });
    }
  }
}
