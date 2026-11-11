import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { extractAuditRequestContext } from '../../../../core/audit/utils/audit-request-context.util';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import { TENANT_ID_HEADER } from '../../../roles/shared/utils/resolve-caller-tenant.util';
import { CreateTenantApprovalRequestDto } from '../../shared/dto/approval-request.dto';
import type { ApprovalRequestResponse } from '../../shared/services/approval-requests.service';
import { TenantApprovalsService } from '../services/tenant-approvals.service';

@ApiTags('Approvals - Tenant')
@ApiBearerAuth('bearer')
@ApiHeader({
  name: TENANT_ID_HEADER,
  required: false,
  description: 'Must match the caller tenant membership when sent',
})
@Controller('tenant/approval-requests')
export class TenantApprovalsController {
  constructor(
    private readonly tenantApprovalsService: TenantApprovalsService,
  ) {}

  @Post()
  @Permission(PERMISSIONS.TENANT.APPROVALS_CREATE)
  @ApiOperation({
    summary: 'Submit a change request for protected tenant fields (slug, name)',
  })
  @ApiResponse({ status: 201, description: 'Change request queued as pending' })
  submit(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateTenantApprovalRequestDto,
    @Headers(TENANT_ID_HEADER) tenantId?: string,
  ): Promise<ApprovalRequestResponse> {
    return this.tenantApprovalsService.submit(
      request.user,
      dto,
      extractAuditRequestContext(request),
      tenantId,
    );
  }
}
