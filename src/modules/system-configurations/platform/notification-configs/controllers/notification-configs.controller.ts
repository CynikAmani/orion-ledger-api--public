import {
  Body,
  Controller,
  Get,
  ParseArrayPipe,
  Put,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { extractAuditRequestContext } from '../../../../../core/audit/utils/audit-request-context.util';
import { Permission } from '../../../../auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../../../auth/shared/constants/permissions.constant';
import type { AuthenticatedRequest } from '../../../../auth/shared/guards/permission.guard';
import { SyncNotificationConfigItemDto } from '../dto/sync-notification-configs.dto';
import {
  NotificationConfigsService,
  type NotificationConfigListItem,
  type NotificationConfigRoleOption,
} from '../services/notification-configs.service';

@ApiTags('Notification Configs')
@ApiBearerAuth('bearer')
@Controller('system-configurations/notification-configs')
export class NotificationConfigsController {
  constructor(
    private readonly notificationConfigsService: NotificationConfigsService,
  ) {}

  @Get('roles')
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.READ)
  @ApiOperation({
    summary:
      'List platform roles for the notification-config role picker (numeric roleId)',
  })
  @ApiResponse({ status: 200, description: 'Platform role options' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  listRoles(): Promise<NotificationConfigRoleOption[]> {
    return this.notificationConfigsService.listRoles();
  }

  @Get()
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.READ)
  @ApiOperation({
    summary:
      'List platform notification actions with platform roles that should be notified',
  })
  @ApiResponse({ status: 200, description: 'Platform notification config list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findAll(): Promise<NotificationConfigListItem[]> {
    return this.notificationConfigsService.findAll();
  }

  @Put('sync')
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.MANAGE)
  @ApiOperation({
    summary:
      'Bulk sync which platform roles are notified for each platform action',
  })
  @ApiBody({ type: SyncNotificationConfigItemDto, isArray: true })
  @ApiResponse({ status: 200, description: 'Notification configs synchronized' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  sync(
    @Req() request: AuthenticatedRequest,
    @Body(new ParseArrayPipe({ items: SyncNotificationConfigItemDto }))
    items: SyncNotificationConfigItemDto[],
  ): Promise<NotificationConfigListItem[]> {
    return this.notificationConfigsService.sync(
      items,
      extractAuditRequestContext(request),
    );
  }
}
