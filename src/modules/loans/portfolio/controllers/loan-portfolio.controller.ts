import { Controller, Get, Req } from '@nestjs/common';
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
import {
  LoanPortfolioService,
  type LoanPortfolioSnapshotResponse,
} from '../services/loan-portfolio.service';

@ApiTags('Loan Portfolio')
@ApiBearerAuth('bearer')
@Controller('loan-portfolio')
export class LoanPortfolioController {
  constructor(private readonly loanPortfolioService: LoanPortfolioService) {}

  @Get()
  @Permission(PERMISSIONS.LOAN_PORTFOLIO.READ)
  @ApiOperation({
    summary: 'Operational loan portfolio snapshot for the caller\'s tenant',
  })
  @ApiResponse({ status: 200, description: 'Portfolio snapshot' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  getSnapshot(
    @Req() request: AuthenticatedRequest,
  ): Promise<LoanPortfolioSnapshotResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loanPortfolioService.getSnapshot(tenantId);
  }
}
