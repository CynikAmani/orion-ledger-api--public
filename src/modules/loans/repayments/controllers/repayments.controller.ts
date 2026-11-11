import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { extractAuditRequestContext } from '../../../../core/audit/utils/audit-request-context.util';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import { resolveCallerTenantId } from '../../../roles/shared/utils/resolve-caller-tenant.util';
import { CreateRepaymentDto } from '../dto/create-repayment.dto';
import {
  RepaymentsService,
  type RecordRepaymentResponse,
  type RepaymentResponse,
} from '../services/repayments.service';

@ApiTags('Repayments')
@ApiBearerAuth('bearer')
@Controller('repayments/loans')
export class RepaymentsController {
  constructor(private readonly repaymentsService: RepaymentsService) {}

  @Get('mine/:loanId')
  @Permission(PERMISSIONS.REPAYMENTS.SELF_READ)
  @ApiOperation({
    summary:
      'List repayment history for an own loan by publicId (customer; path :loanId is publicId)',
  })
  @ApiResponse({ status: 200, description: 'Own repayment history' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Loan not found' })
  listMineByLoan(
    @Req() request: AuthenticatedRequest,
    @Param('loanId') loanId: string,
  ): Promise<RepaymentResponse[]> {
    return this.repaymentsService.listMineByLoanId(
      request.user.id,
      loanId,
    );
  }

  @Get(':loanId')
  @Permission(PERMISSIONS.REPAYMENTS.READ)
  @ApiOperation({
    summary:
      'List repayment history for a loan by publicId in the caller\'s tenant',
  })
  @ApiResponse({ status: 200, description: 'Repayment history' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  @ApiNotFoundResponse({ description: 'Loan not found' })
  listByLoan(
    @Req() request: AuthenticatedRequest,
    @Param('loanId') loanId: string,
  ): Promise<RepaymentResponse[]> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.repaymentsService.listByLoanId(tenantId, loanId);
  }

  @Post(':loanId')
  @Permission(PERMISSIONS.REPAYMENTS.CREATE)
  @ApiOperation({
    summary:
      'Record a repayment against a loan by publicId in the caller\'s tenant',
  })
  @ApiResponse({ status: 201, description: 'Repayment recorded' })
  @ApiNotFoundResponse({ description: 'Loan not found' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  record(
    @Req() request: AuthenticatedRequest,
    @Param('loanId') loanId: string,
    @Body() dto: CreateRepaymentDto,
  ): Promise<RecordRepaymentResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.repaymentsService.record(
      tenantId,
      loanId,
      request.user.id,
      dto.amount,
      extractAuditRequestContext(request),
    );
  }
}
