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
import { UpdateMfaSettingDto } from '../dto/update-mfa-setting.dto';
import {
  MfaSettingsService,
  type MfaSettingResponse,
  type UpdateMfaSettingResponse,
} from '../services/mfa-settings.service';

@ApiTags('MFA Settings')
@ApiBearerAuth('bearer')
@Controller('system-configurations/mfa-settings')
export class MfaSettingsController {
  constructor(private readonly mfaSettingsService: MfaSettingsService) {}

  @Get()
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.READ)
  @ApiOperation({ summary: 'Get the current MFA enabled state' })
  @ApiResponse({ status: 200, description: 'Current MFA setting' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getMfaSetting(): Promise<MfaSettingResponse> {
    return this.mfaSettingsService.getMfaSetting();
  }

  @Patch()
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.MANAGE)
  @ApiOperation({ summary: 'Enable or disable email MFA for native sign-in' })
  @ApiResponse({ status: 200, description: 'MFA setting updated' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  updateMfaSetting(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateMfaSettingDto,
  ): Promise<UpdateMfaSettingResponse> {
    return this.mfaSettingsService.updateMfaSetting(
      dto.enabled,
      extractAuditRequestContext(request),
    );
  }
}
