import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
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
import { ListLoanApplicationsQueryDto } from '../dto/list-loan-applications-query.dto';
import {
  LoanApplicationsService,
  type ApproveLoanApplicationResponse,
  type LoanApplicationDetailResponse,
  type LoanApplicationResponse,
  type LoanApplicationsListResponse,
} from '../services/loan-applications.service';

@ApiTags('Loans - Applications')
@ApiBearerAuth('bearer')
@Controller('loans/applications')
export class LoanApplicationsController {
  constructor(
    private readonly loanApplicationsService: LoanApplicationsService,
  ) {}

  @Get()
  @Permission(PERMISSIONS.LOAN_APPLICATIONS.READ)
  @ApiOperation({
    summary: 'List loan applications for the caller\'s tenant (staff)',
  })
  @ApiResponse({ status: 200, description: 'Application list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListLoanApplicationsQueryDto,
  ): Promise<LoanApplicationsListResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loanApplicationsService.findAll(tenantId, query);
  }

  @Get(':id')
  @Permission(PERMISSIONS.LOAN_APPLICATIONS.READ)
  @ApiOperation({ summary: 'Get a loan application by ID (staff)' })
  @ApiResponse({ status: 200, description: 'Application found' })
  @ApiNotFoundResponse({ description: 'Application not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LoanApplicationDetailResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loanApplicationsService.findOne(tenantId, id);
  }

  @Patch(':id/reviewed')
  @Permission(PERMISSIONS.LOAN_APPLICATIONS.MARK_REVIEWED)
  @ApiOperation({ summary: 'Mark a loan application as reviewed' })
  @ApiResponse({ status: 200, description: 'Application marked reviewed' })
  @ApiNotFoundResponse({ description: 'Application not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  markReviewed(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LoanApplicationResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loanApplicationsService.markReviewed(
      tenantId,
      id,
      extractAuditRequestContext(request),
    );
  }

  @Post(':id/approve')
  @Permission(PERMISSIONS.LOAN_APPLICATIONS.APPROVE)
  @ApiOperation({
    summary: 'Approve a loan application and create a loan record',
  })
  @ApiResponse({ status: 201, description: 'Loan created; application deleted' })
  @ApiNotFoundResponse({ description: 'Application or interest rate not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  approve(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApproveLoanApplicationResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loanApplicationsService.approve(
      tenantId,
      id,
      request.user.id,
      extractAuditRequestContext(request),
    );
  }

  @Post(':id/decline')
  @Permission(PERMISSIONS.LOAN_APPLICATIONS.DECLINE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Decline a loan application' })
  @ApiResponse({ status: 204, description: 'Application declined and deleted' })
  @ApiNotFoundResponse({ description: 'Application not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  decline(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loanApplicationsService.decline(
      tenantId,
      id,
      request.user.id,
      extractAuditRequestContext(request),
    );
  }

  @Delete(':id')
  @Permission(PERMISSIONS.LOAN_APPLICATIONS.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a loan application without decline messaging',
  })
  @ApiResponse({ status: 204, description: 'Application deleted' })
  @ApiNotFoundResponse({ description: 'Application not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loanApplicationsService.removeByStaff(
      tenantId,
      id,
      extractAuditRequestContext(request),
    );
  }
}
