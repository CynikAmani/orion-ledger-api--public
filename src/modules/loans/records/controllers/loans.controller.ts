import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { extractAuditRequestContext } from '../../../../core/audit/utils/audit-request-context.util';
import {
  APP_ERROR_CODES,
  appHttpException,
} from '../../../../common/exceptions/app-http.exception';
import { optionalImageFilePipe } from '../../../../core/storage/pipes/optional-image-file.pipe';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import { resolveCallerTenantId } from '../../../roles/shared/utils/resolve-caller-tenant.util';
import { IssueLoanDto } from '../dto/issue-loan.dto';
import { ListLoansQueryDto } from '../dto/list-loans-query.dto';
import { UpdateLoanDto } from '../dto/update-loan.dto';
import { LoanDatasetService } from '../services/loan-dataset.service';
import {
  LoansService,
  type LoanDetailResponse,
  type LoansListResponse,
  type RenewLoanResponse,
} from '../services/loans.service';
import { UPDATE_LOAN_MULTIPART_BODY } from '../swagger/loan-record-multipart.swagger';

const LOAN_DATASET_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('Loans - Records')
@ApiBearerAuth('bearer')
@Controller('loans')
export class LoansController {
  constructor(
    private readonly loansService: LoansService,
    private readonly loanDataset: LoanDatasetService,
  ) {}

  @Get()
  @Permission(PERMISSIONS.LOANS.READ)
  @ApiOperation({ summary: 'List loan records for the caller\'s tenant (staff)' })
  @ApiResponse({ status: 200, description: 'Loan list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListLoansQueryDto,
  ): Promise<LoansListResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loansService.findAll(tenantId, query);
  }

  @Post('issue')
  @Permission(PERMISSIONS.LOANS.CREATE)
  @ApiOperation({ summary: 'Issue a loan directly to a customer' })
  @ApiResponse({ status: 201, description: 'Loan issued' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions or blocked' })
  issue(
    @Req() request: AuthenticatedRequest,
    @Body() dto: IssueLoanDto,
  ): Promise<LoanDetailResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loansService.issue(
      tenantId,
      request.user.id,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Get('dataset')
  @Permission(PERMISSIONS.LOANS.READ)
  @ApiOperation({
    summary:
      "Download this institution's loan records as an Excel file, grouped by status",
    description:
      'Sets Content-Disposition with the workbook filename (also exposed via CORS). Parse filename from that header; do not invent a local name.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Excel workbook. Filename is {brand-name}_loan-records-{unique}.xlsx in Content-Disposition.',
  })
  @ApiResponse({
    status: 422,
    description:
      'No loan records. JSON body errorCode is LOAN_DATASET_EMPTY. Do not save a file.',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async downloadDataset(
    @Req() request: AuthenticatedRequest,
  ): Promise<StreamableFile> {
    const tenantId = resolveCallerTenantId(request.user);
    const download = await this.loanDataset.buildForTenant(tenantId);
    if (download.kind === 'empty') {
      throw appHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'This institution has no loan records to download',
        APP_ERROR_CODES.LOAN_DATASET_EMPTY,
      );
    }

    const encodedName = encodeURIComponent(download.filename);
    return new StreamableFile(download.body, {
      type: LOAN_DATASET_TYPE,
      disposition: `attachment; filename="${download.filename}"; filename*=UTF-8''${encodedName}`,
    });
  }

  @Post('reconcile-statuses')
  @Permission(PERMISSIONS.LOANS.UPDATE)
  @ApiOperation({
    summary: 'Reconcile loan status/isCleared from payments and end dates',
  })
  @ApiResponse({ status: 200, description: 'Reconciliation complete' })
  reconcileStatuses(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ updated: number }> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loansService.reconcileStatusesFromRepayments(tenantId);
  }

  @Get(':loanId')
  @Permission(PERMISSIONS.LOANS.READ)
  @ApiOperation({
    summary: 'Get a loan record by publicId (staff; path :loanId is publicId)',
  })
  @ApiResponse({ status: 200, description: 'Loan found' })
  @ApiNotFoundResponse({ description: 'Loan not found' })
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('loanId') loanId: string,
  ): Promise<LoanDetailResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loansService.findOne(tenantId, loanId);
  }

  @Patch(':loanId')
  @Permission(PERMISSIONS.LOANS.UPDATE)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody(UPDATE_LOAN_MULTIPART_BODY)
  @ApiOperation({
    summary:
      'Update an open (active or overdue) loan by publicId; omit file to keep the current collateral photo',
  })
  @ApiResponse({ status: 200, description: 'Loan updated' })
  @ApiNotFoundResponse({ description: 'Loan not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('loanId') loanId: string,
    @Body() dto: UpdateLoanDto,
    @UploadedFile(optionalImageFilePipe) file?: Express.Multer.File,
  ): Promise<LoanDetailResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loansService.update(
      tenantId,
      loanId,
      dto,
      extractAuditRequestContext(request),
      file,
    );
  }

  @Post(':loanId/renew')
  @Permission(PERMISSIONS.LOANS.CREATE)
  @ApiOperation({
    summary:
      'Renew a loan by publicId (pay remaining balance, then issue identical loan)',
  })
  @ApiResponse({ status: 201, description: 'Loan renewed' })
  renew(
    @Req() request: AuthenticatedRequest,
    @Param('loanId') loanId: string,
  ): Promise<RenewLoanResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loansService.renew(
      tenantId,
      loanId,
      request.user.id,
      extractAuditRequestContext(request),
    );
  }

  @Post(':loanId/duplicate')
  @Permission(PERMISSIONS.LOANS.CREATE)
  @ApiOperation({
    summary:
      'Duplicate a loan by publicId as a new parallel loan (original untouched)',
  })
  @ApiResponse({ status: 201, description: 'Parallel loan created' })
  duplicate(
    @Req() request: AuthenticatedRequest,
    @Param('loanId') loanId: string,
  ): Promise<LoanDetailResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loansService.duplicate(
      tenantId,
      loanId,
      request.user.id,
      extractAuditRequestContext(request),
    );
  }

  @Post(':loanId/default')
  @Permission(PERMISSIONS.LOANS.UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a loan as defaulted by publicId (staff decision)',
  })
  @ApiResponse({ status: 200, description: 'Loan marked defaulted' })
  markDefaulted(
    @Req() request: AuthenticatedRequest,
    @Param('loanId') loanId: string,
  ): Promise<LoanDetailResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loansService.markDefaulted(
      tenantId,
      loanId,
      extractAuditRequestContext(request),
    );
  }
}
