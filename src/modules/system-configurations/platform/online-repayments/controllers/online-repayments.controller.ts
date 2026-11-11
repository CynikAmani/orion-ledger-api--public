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
import { UpdateOnlineRepaymentsSettingDto } from '../dto/update-online-repayments-setting.dto';
import {
  OnlineRepaymentsService,
  type OnlineRepaymentsSettingResponse,
  type UpdateOnlineRepaymentsSettingResponse,
} from '../services/online-repayments.service';

@ApiTags('Online Repayments')
@ApiBearerAuth('bearer')
@Controller('system-configurations/online-repayments')
export class OnlineRepaymentsController {
  constructor(
    private readonly onlineRepaymentsService: OnlineRepaymentsService,
  ) {}

  @Get()
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.READ)
  @ApiOperation({
    summary: 'Get the current online repayments enabled state',
  })
  @ApiResponse({ status: 200, description: 'Current online repayments setting' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getOnlineRepaymentsSetting(): Promise<OnlineRepaymentsSettingResponse> {
    return this.onlineRepaymentsService.getOnlineRepaymentsSetting();
  }

  @Patch()
  @Permission(PERMISSIONS.SYSTEM_CONFIGURATIONS.MANAGE)
  @ApiOperation({ summary: 'Enable or disable online loan repayments' })
  @ApiResponse({
    status: 200,
    description: 'Online repayments setting updated',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  updateOnlineRepaymentsSetting(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateOnlineRepaymentsSettingDto,
  ): Promise<UpdateOnlineRepaymentsSettingResponse> {
    return this.onlineRepaymentsService.updateOnlineRepaymentsSetting(
      dto.enabled,
      extractAuditRequestContext(request),
    );
  }
}
