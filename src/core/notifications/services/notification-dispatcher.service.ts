import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BrevoEmailService } from '../../email/services/brevo-email.service';
import { buildStaffDispatchEmail } from '../templates/staff-dispatch.email';
import {
  DEFAULT_PLATFORM_NOTIFICATION_CONFIGS,
  DEFAULT_TENANT_NOTIFICATION_CONFIGS,
} from '../constants/notification-action-keys.constant';
import { TenantNotificationEmailsSettingsService } from '../../../modules/system-configurations/platform/tenant-notification-emails/services/tenant-notification-emails-settings.service';
import { NOTIFICATION_TYPES } from '../constants/notification-type.constant';
import { NotificationsService } from './notifications.service';

export interface DispatchNotificationPayload {
  subject: string;
  message: string;
  templateData?: Record<string, unknown>;
}

export interface DispatchNotificationOptions {
  /**
   * When set, look up tenant-scoped NotificationConfig and tenant-role recipients.
   * When omitted / null, look up platform-scoped config (tenantId null).
   */
  tenantId?: string | null;
}

/**
 * Resolves which roles should be notified for a business action, then:
 * 1. always writes an in-app notification for each matched user
 * 2. emails matched users when allowed (platform always; tenant only if
 *    tenant_notification_emails_enabled is on)
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: BrevoEmailService,
    private readonly notificationsService: NotificationsService,
    private readonly tenantNotificationEmailsSettings: TenantNotificationEmailsSettingsService,
  ) {}

  async dispatch(
    actionKey: string,
    payload: DispatchNotificationPayload,
    options?: DispatchNotificationOptions,
  ): Promise<void> {
    const tenantId =
      typeof options?.tenantId === 'string' &&
      options.tenantId.trim().length > 0
        ? options.tenantId.trim()
        : null;
    const isTenantScoped = tenantId != null;

    let config = await this.findConfig(actionKey, tenantId);
    if (!config) {
      await this.ensureCatalog(tenantId);
      config = await this.findConfig(actionKey, tenantId);
    }

    if (!config) {
      this.logger.warn(
        `No notification config found for action key "${actionKey}"` +
          (isTenantScoped ? ` (tenant ${tenantId})` : ' (platform)'),
      );
      return;
    }

    const roleIds = config.roles
      .filter((entry) =>
        isTenantScoped
          ? entry.role.tenantId === tenantId
          : entry.role.tenantId == null,
      )
      .map((entry) => entry.roleId);

    if (roleIds.length === 0) {
      this.logger.debug(
        `Skipping dispatch for "${actionKey}": no recipient roles mapped`,
      );
      return;
    }

    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(isTenantScoped ? { tenantId } : { tenantId: null }),
        userRoles: {
          some: {
            roleId: { in: roleIds },
            ...(isTenantScoped ? { tenantId } : { tenantId: null }),
          },
        },
      },
      select: {
        id: true,
        userId: true,
        email: true,
        fullname: true,
      },
      distinct: ['id'],
    });

    if (users.length === 0) {
      this.logger.debug(
        `Skipping dispatch for "${actionKey}": no users matched mapped roles`,
      );
      return;
    }

    const allowEmail =
      !isTenantScoped ||
      (await this.tenantNotificationEmailsSettings.isEnabled());

    let emailedCount = 0;

    for (const user of users) {
      this.notificationsService.push({
        targetUser: user.id,
        type: NOTIFICATION_TYPES.ALERT,
        content: payload.message,
      });

      if (allowEmail && user.email) {
        const email = buildStaffDispatchEmail({
          actionKey,
          recipientName: user.fullname,
          subject: payload.subject,
          message: payload.message,
          templateData: payload.templateData,
        });
        void this.emailService.send({
          to: user.email,
          subject: payload.subject,
          html: email.html,
          text: email.text,
          params: payload.templateData
            ? this.toEmailParams(payload.templateData)
            : undefined,
        });
        emailedCount += 1;
      }
    }

    this.logger.log(
      `Dispatched "${actionKey}" to ${users.length} user(s) (${emailedCount} emailed` +
        (isTenantScoped && !allowEmail ? '; tenant emails disabled' : '') +
        ')',
    );
  }

  private findConfig(actionKey: string, tenantId: string | null) {
    return this.prisma.notificationConfig.findFirst({
      where: {
        actionKey,
        tenantId,
      },
      select: {
        configId: true,
        roles: {
          select: {
            roleId: true,
            role: {
              select: { tenantId: true },
            },
          },
        },
      },
    });
  }

  private async ensureCatalog(tenantId: string | null): Promise<void> {
    const defaults =
      tenantId == null
        ? DEFAULT_PLATFORM_NOTIFICATION_CONFIGS
        : DEFAULT_TENANT_NOTIFICATION_CONFIGS;
    const keys = defaults.map((row) => row.actionKey);

    await this.prisma.notificationConfig.deleteMany({
      where: {
        tenantId,
        actionKey: { notIn: [...keys] },
      },
    });

    const existing = await this.prisma.notificationConfig.findMany({
      where: { tenantId },
      select: { actionKey: true },
    });
    const existingKeys = new Set(existing.map((row) => row.actionKey));
    const missing = defaults.filter((row) => !existingKeys.has(row.actionKey));

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

  private toEmailParams(
    templateData: Record<string, unknown>,
  ): Record<string, string | number | boolean> {
    const params: Record<string, string | number | boolean> = {};

    for (const [key, value] of Object.entries(templateData)) {
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        params[key] = value;
      }
    }

    return params;
  }
}
