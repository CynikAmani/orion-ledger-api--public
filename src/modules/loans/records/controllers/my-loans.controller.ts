import {
  Body,
  Controller,
  Get,
  Param,
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
import { CreateApplicationFromLoanDto } from '../dto/create-application-from-loan.dto';
import { ListMyLoansQueryDto } from '../dto/list-my-loans-query.dto';
import {
  LoansService,
  type ApplicationFromLoanResponse,
  type LoanDetailResponse,
  type LoansListResponse,
} from '../services/loans.service';

@ApiTags('Loans - My Records')
@ApiBearerAuth('bearer')
@Controller('loans/mine')
export class MyLoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get()
  @Permission(PERMISSIONS.LOANS.SELF_READ)
  @ApiOperation({ summary: 'List own loan records' })
  @ApiResponse({ status: 200, description: 'Own loan list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findMine(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListMyLoansQueryDto,
  ): Promise<LoansListResponse> {
    return this.loansService.findMine(request.user.id, query);
  }

  @Get(':loanId')
  @Permission(PERMISSIONS.LOANS.SELF_READ)
  @ApiOperation({
    summary: 'Get one own loan record by publicId (path :loanId is publicId)',
  })
  @ApiResponse({ status: 200, description: 'Loan found' })
  @ApiNotFoundResponse({ description: 'Loan not found' })
  findOneMine(
    @Req() request: AuthenticatedRequest,
    @Param('loanId') loanId: string,
  ): Promise<LoanDetailResponse> {
    return this.loansService.findOneMine(request.user.id, loanId);
  }

  @Post(':loanId/renew')
  @Permission(PERMISSIONS.LOAN_APPLICATIONS.CREATE)
  @ApiOperation({
    summary:
      'Create a loan application from a cleared loan by publicId (customer renew)',
  })
  @ApiResponse({ status: 201, description: 'Application created from loan' })
  renewAsApplication(
    @Req() request: AuthenticatedRequest,
    @Param('loanId') loanId: string,
    @Body() dto: CreateApplicationFromLoanDto,
  ): Promise<ApplicationFromLoanResponse> {
    return this.loansService.renewAsApplication(
      request.user.id,
      loanId,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Post(':loanId/duplicate')
  @Permission(PERMISSIONS.LOAN_APPLICATIONS.CREATE)
  @ApiOperation({
    summary:
      'Create a loan application from an open loan by publicId (customer duplicate / parallel ask)',
  })
  @ApiResponse({ status: 201, description: 'Application created from loan' })
  duplicateAsApplication(
    @Req() request: AuthenticatedRequest,
    @Param('loanId') loanId: string,
    @Body() dto: CreateApplicationFromLoanDto,
  ): Promise<ApplicationFromLoanResponse> {
    return this.loansService.duplicateAsApplication(
      request.user.id,
      loanId,
      dto,
      extractAuditRequestContext(request),
    );
  }
}
