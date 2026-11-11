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
import { LoanInsightsQueryDto } from '../dto/insights-query.dto';
import {
  LoanInsightsService,
  type LoanInsightsSnapshotResponse,
} from '../services/loan-insights.service';

@ApiTags('Loan Insights')
@ApiBearerAuth('bearer')
@Controller('loan-insights')
export class LoanInsightsController {
  constructor(private readonly loanInsightsService: LoanInsightsService) {}

  @Get()
  @Permission(PERMISSIONS.LOAN_INSIGHTS.READ)
  @ApiOperation({
    summary: 'Chart-ready loan insights snapshot (staff)',
  })
  @ApiResponse({ status: 200, description: 'Insights snapshot' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  getSnapshot(
    @Req() request: AuthenticatedRequest,
    @Query() query: LoanInsightsQueryDto,
  ): Promise<LoanInsightsSnapshotResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loanInsightsService.getSnapshot(tenantId, query);
  }
}
