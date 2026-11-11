import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import { resolveCallerTenantId } from '../../../roles/shared/utils/resolve-caller-tenant.util';
import { ReportQueryDto } from '../dto/report-query.dto';
import {
  LoanReportsService,
  type LoanReportsSnapshotResponse,
} from '../services/loan-reports.service';

@ApiTags('Loan Reports')
@ApiBearerAuth('bearer')
@Controller('loan-reports')
export class LoanReportsController {
  constructor(private readonly loanReportsService: LoanReportsService) {}

  @Get()
  @Permission(PERMISSIONS.LOAN_REPORTS.READ)
  @ApiOperation({
    summary: 'Historical loan reports snapshot for a period (staff)',
  })
  @ApiResponse({ status: 200, description: 'Reports snapshot' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  getSnapshot(
    @Req() request: AuthenticatedRequest,
    @Query() query: ReportQueryDto,
  ): Promise<LoanReportsSnapshotResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loanReportsService.getSnapshot(tenantId, query);
  }
}
