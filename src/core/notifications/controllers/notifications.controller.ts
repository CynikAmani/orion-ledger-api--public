import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Notification } from '@prisma/client';
import { CurrentUser } from '../../../modules/auth/shared/decorators/current-user.decorator';
import { Permission } from '../../../modules/auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../../modules/auth/shared/constants/permissions.constant';
import { GetNotificationsQueryDto } from '../dto/get-notifications-query.dto';
import { MarkViewedDto } from '../dto/mark-viewed.dto';
import {
  MarkNotificationsViewedResult,
  NotificationsService,
  PaginatedNotificationsResult,
} from '../services/notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth('bearer')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('unseen')
  @Permission(PERMISSIONS.NOTIFICATIONS.READ)
  @ApiOperation({
    summary:
      'List up to 10 unviewed notifications for the authenticated user (top-bar preview)',
  })
  @ApiResponse({ status: 200, description: 'Unviewed notifications' })
  getUnseen(@CurrentUser() targetUser: number): Promise<Notification[]> {
    return this.notificationsService.getUnseen(targetUser);
  }

  @Get()
  @Permission(PERMISSIONS.NOTIFICATIONS.READ)
  @ApiOperation({
    summary:
      'List notifications with cursor-based pagination and optional type filter',
  })
  @ApiResponse({ status: 200, description: 'Paginated notifications' })
  findAll(
    @CurrentUser() targetUser: number,
    @Query() query: GetNotificationsQueryDto,
  ): Promise<PaginatedNotificationsResult> {
    return this.notificationsService.findAll(targetUser, query);
  }

  @Patch('mark-viewed')
  @Permission(PERMISSIONS.NOTIFICATIONS.READ)
  @ApiOperation({
    summary:
      'Mark specific notifications as viewed, or all unviewed notifications when no IDs are provided',
  })
  @ApiResponse({ status: 200, description: 'Notifications marked as viewed' })
  markAsViewed(
    @CurrentUser() targetUser: number,
    @Body() markViewedDto: MarkViewedDto,
  ): Promise<MarkNotificationsViewedResult> {
    return this.notificationsService.markAsViewed(
      targetUser,
      markViewedDto.notificationIds,
    );
  }
}
