import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuditContext } from '../../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../../core/database/prisma.service';
import {
  DEFAULT_PLATFORM_NOTIFICATION_CONFIGS,
  PLATFORM_NOTIFICATION_ACTION_KEY_SET,
} from '../../../../../core/notifications/constants/notification-action-keys.constant';
import type { SyncNotificationConfigItemDto } from '../dto/sync-notification-configs.dto';

export interface NotificationConfigListItem {
  actionKey: string;
  description: string | null;
  assignedRoleIds: number[];
  assignedRoles: Array<{
    roleId: number;
    key: string;
    name: string;
  }>;
}

/** Role picker option for notification-config sync (numeric roleId). */
export interface NotificationConfigRoleOption {
  roleId: number;
  key: string;
  name: string;
  description: string | null;
}

@Injectable()
export class NotificationConfigsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
  ) {}

  /** Platform roles only — for notification config role pickers. */
  async listRoles(): Promise<NotificationConfigRoleOption[]> {
    const roles = await this.prisma.role.findMany({
      where: { tenantId: null },
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

  async findAll(): Promise<NotificationConfigListItem[]> {
    await this.ensureCatalog();

    const configs = await this.prisma.notificationConfig.findMany({
      where: { tenantId: null },
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
      const platformRoles = config.roles.filter(
        (entry) => entry.role.tenantId == null,
      );
      return {
        actionKey: config.actionKey,
        description: config.description,
        assignedRoleIds: platformRoles.map((entry) => entry.roleId),
        assignedRoles: platformRoles.map((entry) => ({
          roleId: entry.role.roleId,
          key: entry.role.key,
          name: entry.role.name,
        })),
      };
    });
  }

  async sync(
    items: SyncNotificationConfigItemDto[],
    auditContext: AuditContext,
  ): Promise<NotificationConfigListItem[]> {
    if (items.length === 0) {
      throw new BadRequestException(
        'At least one notification config is required',
      );
    }

    await this.ensureCatalog();

    const actionKeys = items.map((item) => item.actionKey);
    const uniqueActionKeys = new Set(actionKeys);
    if (uniqueActionKeys.size !== actionKeys.length) {
      throw new BadRequestException('Duplicate actionKey values are not allowed');
    }

    for (const actionKey of actionKeys) {
      if (!PLATFORM_NOTIFICATION_ACTION_KEY_SET.has(actionKey)) {
        throw new BadRequestException(
          `Unknown or non-platform notification action key: ${actionKey}`,
        );
      }
    }

    const existingConfigs = await this.prisma.notificationConfig.findMany({
      where: { tenantId: null, actionKey: { in: actionKeys } },
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
      const platformRoles = await this.prisma.role.findMany({
        where: { roleId: { in: allRoleIds }, tenantId: null },
        select: { roleId: true },
      });

      if (platformRoles.length !== allRoleIds.length) {
        throw new BadRequestException(
          'One or more role IDs are missing or are not platform roles',
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
      action: 'NOTIFICATION_CONFIGS_SYNCED',
      targetType: 'NotificationConfig',
      payload: {
        scope: 'platform',
        configs: items.map((item) => ({
          actionKey: item.actionKey,
          roleIds: item.roleIds,
        })),
      },
    });

    return this.findAll();
  }

  private async ensureCatalog(): Promise<void> {
    const platformKeys = DEFAULT_PLATFORM_NOTIFICATION_CONFIGS.map(
      (row) => row.actionKey,
    );

    // Drop retired / non-platform leftover rows that still have tenantId null.
    await this.prisma.notificationConfig.deleteMany({
      where: {
        tenantId: null,
        actionKey: { notIn: [...platformKeys] },
      },
    });

    const existing = await this.prisma.notificationConfig.findMany({
      where: { tenantId: null },
      select: { actionKey: true },
    });
    const existingKeys = new Set(existing.map((row) => row.actionKey));
    const missing = DEFAULT_PLATFORM_NOTIFICATION_CONFIGS.filter(
      (row) => !existingKeys.has(row.actionKey),
    );

    if (missing.length > 0) {
      await this.prisma.notificationConfig.createMany({
        data: missing.map((config) => ({
          tenantId: null,
          actionKey: config.actionKey,
          description: config.description,
        })),
      });
    }
  }
}
