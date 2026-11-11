import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { UpdateTenantNotificationEmailsSettingDto } from '../dto/update-tenant-notification-emails-setting.dto';
import {
  TenantNotificationEmailsSettingsService,
  type TenantNotificationEmailsSettingResponse,
  type UpdateTenantNotificationEmailsSettingResponse,
} from '../services/tenant-notification-emails-settings.service';

@ApiTags('Tenant Notification Emails')
@ApiBearerAuth('bearer')
@Controller('system-configurations/tenant-notification-emails')
export class TenantNotificationEmailsSettingsController {
  constructor(
    private readonly tenantNotificationEmailsSettingsService: TenantNotificationEmailsSettingsService,
  ) {}

  @Get()
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.READ)
  @ApiOperation({
    summary:
      'Get whether tenant staff notification emails (and tenant notification-config UI) are enabled',
  })
  @ApiResponse({ status: 200, description: 'Current setting' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getSetting(): Promise<TenantNotificationEmailsSettingResponse> {
    return this.tenantNotificationEmailsSettingsService.getSetting();
  }

  @Patch()
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.MANAGE)
  @ApiOperation({
    summary:
      'Enable or disable tenant staff notification emails system-wide (in-app alerts still fire)',
  })
  @ApiResponse({ status: 200, description: 'Setting updated' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  updateSetting(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateTenantNotificationEmailsSettingDto,
  ): Promise<UpdateTenantNotificationEmailsSettingResponse> {
    return this.tenantNotificationEmailsSettingsService.updateSetting(
      dto.enabled,
      extractAuditRequestContext(request),
    );
  }
}
