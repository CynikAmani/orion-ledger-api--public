import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GetPlatformAuditLogsQueryDto } from '../../../core/audit/dto/get-platform-audit-logs-query.dto';
import {
  AuditService,
  type AuditLogsListResponse,
} from '../../../core/audit/services/audit.service';
import { PERMISSIONS } from '../../auth/shared/constants/permissions.constant';
import { Permission } from '../../auth/shared/decorators/permission.decorator';

@ApiTags('Audit Logs - Platform')
@ApiBearerAuth('bearer')
@Controller('platform/audit-logs')
export class PlatformAuditLogsController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permission(PERMISSIONS.PLATFORM.AUDIT_READ)
  @ApiOperation({
    summary: 'List platform audit logs',
    description:
      'Default: platform-owned rows (tenantId null) plus PLATFORM-module events (onboarding, platform user/role IAM). Pass tenantId to inspect one tenant.',
  })
  @ApiResponse({ status: 200, description: 'Paginated platform audit logs' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findAll(
    @Query() query: GetPlatformAuditLogsQueryDto,
  ): Promise<AuditLogsListResponse> {
    return this.auditService.findForPlatform(query);
  }
}
