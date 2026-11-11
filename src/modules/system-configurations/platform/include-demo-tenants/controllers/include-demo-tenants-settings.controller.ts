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
import { UpdateIncludeDemoTenantsSettingDto } from '../dto/update-include-demo-tenants-setting.dto';
import {
  IncludeDemoTenantsSettingsService,
  type IncludeDemoTenantsSettingResponse,
  type UpdateIncludeDemoTenantsSettingResponse,
} from '../services/include-demo-tenants-settings.service';

@ApiTags('Include Demo Tenants')
@ApiBearerAuth('bearer')
@Controller('system-configurations/include-demo-tenants')
export class IncludeDemoTenantsSettingsController {
  constructor(
    private readonly includeDemoTenantsSettingsService: IncludeDemoTenantsSettingsService,
  ) {}

  @Get()
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.READ)
  @ApiOperation({
    summary:
      'Get whether the applicant brand catalog includes demo institutions',
  })
  @ApiResponse({ status: 200, description: 'Current setting' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getSetting(): Promise<IncludeDemoTenantsSettingResponse> {
    return this.includeDemoTenantsSettingsService.getSetting();
  }

  @Patch()
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.MANAGE)
  @ApiOperation({
    summary:
      'Enable or disable including demo institutions in the applicant brand catalog (public lookups never include demos)',
  })
  @ApiResponse({ status: 200, description: 'Setting updated' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  updateSetting(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateIncludeDemoTenantsSettingDto,
  ): Promise<UpdateIncludeDemoTenantsSettingResponse> {
    return this.includeDemoTenantsSettingsService.updateSetting(
      dto.enabled,
      extractAuditRequestContext(request),
    );
  }
}
