import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Notification } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { NotificationType } from '../constants/notification-type.constant';
import { GetNotificationsQueryDto } from '../dto/get-notifications-query.dto';

export interface PushNotificationParams {
  targetUser: number;
  type: NotificationType;
  content: string;
}

export interface PaginatedNotificationsResult {
  data: Notification[];
  nextCursor: number | null;
}

export interface MarkNotificationsViewedResult {
  updatedCount: number;
}

const UNSEEN_LIMIT = 10;

const notificationOrderBy = [
  { date: 'desc' as const },
  { notificationId: 'desc' as const },
];

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  push(params: PushNotificationParams): void {
    void this.persist(params);
  }

  async getUnseen(targetUser: number): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: {
        targetUser,
        isViewed: { not: true },
      },
      orderBy: notificationOrderBy,
      take: UNSEEN_LIMIT,
    });
  }

  async findAll(
    targetUser: number,
    query: GetNotificationsQueryDto,
  ): Promise<PaginatedNotificationsResult> {
    const { type, cursor, limit } = query;

    if (cursor !== undefined) {
      await this.assertCursorBelongsToUser(targetUser, cursor, type);
    }

    const where = {
      targetUser,
      ...(type !== undefined ? { notificationType: type } : {}),
    };

    const notifications = await this.prisma.notification.findMany({
      where,
      ...(cursor !== undefined
        ? {
            cursor: { notificationId: cursor },
            skip: 1,
          }
        : {}),
      orderBy: notificationOrderBy,
      take: limit,
    });

    const nextCursor =
      notifications.length === limit
        ? notifications[notifications.length - 1].notificationId
        : null;

    return { data: notifications, nextCursor };
  }

  async markAsViewed(
    targetUser: number,
    notificationIds?: number[],
  ): Promise<MarkNotificationsViewedResult> {
    const shouldMarkAll =
      notificationIds === undefined || notificationIds.length === 0;

    const where = {
      targetUser,
      isViewed: { not: true },
      ...(shouldMarkAll ? {} : { notificationId: { in: notificationIds } }),
    };

    const { count } = await this.prisma.notification.updateMany({
      where,
      data: { isViewed: true },
    });

    return { updatedCount: count };
  }

  private async persist(params: PushNotificationParams): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          notificationType: params.type,
          targetUser: params.targetUser,
          content: params.content,
          date: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to persist notification for user ${params.targetUser} (type: ${params.type})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async assertCursorBelongsToUser(
    targetUser: number,
    cursor: number,
    type?: NotificationType,
  ): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { notificationId: cursor },
      select: { targetUser: true, notificationType: true },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${cursor} was not found`);
    }

    if (notification.targetUser !== targetUser) {
      throw new BadRequestException('Invalid pagination cursor');
    }

    if (type !== undefined && notification.notificationType !== type) {
      throw new BadRequestException(
        'Pagination cursor does not match the active type filter',
      );
    }
  }
}
