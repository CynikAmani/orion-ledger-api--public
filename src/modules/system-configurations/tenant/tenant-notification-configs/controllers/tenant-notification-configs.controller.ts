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
import { resolveCallerTenantId } from '../../../../roles/shared/utils/resolve-caller-tenant.util';
import { SyncNotificationConfigItemDto } from '../../../platform/notification-configs/dto/sync-notification-configs.dto';
import type {
  NotificationConfigListItem,
  NotificationConfigRoleOption,
} from '../../../platform/notification-configs/services/notification-configs.service';
import { TenantNotificationConfigsService } from '../services/tenant-notification-configs.service';

@ApiTags('Tenant Notification Configs')
@ApiBearerAuth('bearer')
@Controller('tenant/system-configurations/notification-configs')
export class TenantNotificationConfigsController {
  constructor(
    private readonly tenantNotificationConfigsService: TenantNotificationConfigsService,
  ) {}

  @Get('roles')
  @Permission(PERMISSIONS.TENANT.CONFIG_READ)
  @ApiOperation({
    summary:
      'List this tenant\'s roles for the notification-config role picker (numeric roleId; requires platform tenant-notification-emails flag)',
  })
  @ApiResponse({ status: 200, description: 'Tenant role options' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description:
      'Insufficient permissions, tenant membership required, or tenant notification emails disabled',
  })
  listRoles(
    @Req() request: AuthenticatedRequest,
  ): Promise<NotificationConfigRoleOption[]> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.tenantNotificationConfigsService.listRoles(tenantId);
  }

  @Get()
  @Permission(PERMISSIONS.TENANT.CONFIG_READ)
  @ApiOperation({
    summary:
      'List this tenant\'s notification actions with roles that should be notified (requires platform tenant-notification-emails flag)',
  })
  @ApiResponse({ status: 200, description: 'Tenant notification config list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description:
      'Insufficient permissions, tenant membership required, or tenant notification emails disabled',
  })
  findAll(
    @Req() request: AuthenticatedRequest,
  ): Promise<NotificationConfigListItem[]> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.tenantNotificationConfigsService.findAll(tenantId);
  }

  @Put('sync')
  @Permission(PERMISSIONS.TENANT.CONFIG_UPDATE)
  @ApiOperation({
    summary:
      'Bulk sync which tenant roles are notified for each tenant action (requires platform tenant-notification-emails flag)',
  })
  @ApiBody({ type: SyncNotificationConfigItemDto, isArray: true })
  @ApiResponse({ status: 200, description: 'Tenant notification configs synchronized' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description:
      'Insufficient permissions, tenant membership required, or tenant notification emails disabled',
  })
  sync(
    @Req() request: AuthenticatedRequest,
    @Body(new ParseArrayPipe({ items: SyncNotificationConfigItemDto }))
    items: SyncNotificationConfigItemDto[],
  ): Promise<NotificationConfigListItem[]> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.tenantNotificationConfigsService.sync(
      tenantId,
      items,
      extractAuditRequestContext(request),
    );
  }
}
