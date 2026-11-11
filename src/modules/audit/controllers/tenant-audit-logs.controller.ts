import { Controller, Get, Headers, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GetAuditLogsQueryDto } from '../../../core/audit/dto/get-audit-logs-query.dto';
import {
  AuditService,
  type AuditLogsListResponse,
} from '../../../core/audit/services/audit.service';
import { PERMISSIONS } from '../../auth/shared/constants/permissions.constant';
import { Permission } from '../../auth/shared/decorators/permission.decorator';
import type { AuthenticatedRequest } from '../../auth/shared/guards/permission.guard';
import {
  resolveCallerTenantId,
  TENANT_ID_HEADER,
} from '../../roles/shared/utils/resolve-caller-tenant.util';

@ApiTags('Audit Logs - Tenant')
@ApiBearerAuth('bearer')
@ApiHeader({
  name: TENANT_ID_HEADER,
  required: false,
  description:
    'Required when the caller belongs to more than one tenant. Must match an active membership.',
})
@Controller('tenant/audit-logs')
export class TenantAuditLogsController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permission(PERMISSIONS.TENANT.AUDIT_READ)
  @ApiOperation({
    summary: "List audit logs for the caller's tenant",
    description:
      'Supports entity history (targetId/targetType), actor profiles (userId), module/action filters, and createdAt windows.',
  })
  @ApiResponse({ status: 200, description: 'Paginated tenant audit logs' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: GetAuditLogsQueryDto,
    @Headers(TENANT_ID_HEADER) tenantId?: string,
  ): Promise<AuditLogsListResponse> {
    return this.auditService.findForTenant(
      resolveCallerTenantId(request.user, tenantId),
      query,
    );
  }
}
