import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
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
import { optionalImageFilePipe } from '../../../../core/storage/pipes/optional-image-file.pipe';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import { CreateLoanApplicationDto } from '../dto/create-loan-application.dto';
import { UpdateLoanApplicationDto } from '../dto/update-loan-application.dto';
import {
  LoanApplicationsService,
  type LoanApplicationDetailResponse,
  type LoanApplicationResponse,
} from '../services/loan-applications.service';
import {
  CREATE_LOAN_APPLICATION_MULTIPART_BODY,
  UPDATE_LOAN_APPLICATION_MULTIPART_BODY,
} from '../swagger/loan-application-multipart.swagger';

@ApiTags('Loans - My Applications')
@ApiBearerAuth('bearer')
@Controller('loans/applications/mine')
export class MyLoanApplicationsController {
  constructor(
    private readonly loanApplicationsService: LoanApplicationsService,
  ) {}

  @Post()
  @Permission(PERMISSIONS.LOAN_APPLICATIONS.CREATE)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody(CREATE_LOAN_APPLICATION_MULTIPART_BODY)
  @ApiOperation({
    summary: 'Submit a loan application (optional collateral image)',
  })
  @ApiResponse({ status: 201, description: 'Application created' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions or blocked' })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateLoanApplicationDto,
    @UploadedFile(optionalImageFilePipe) file?: Express.Multer.File,
  ): Promise<LoanApplicationResponse> {
    return this.loanApplicationsService.createMine(
      request.user.id,
      dto,
      extractAuditRequestContext(request),
      file,
    );
  }

  @Get()
  @Permission(PERMISSIONS.LOAN_APPLICATIONS.SELF_READ)
  @ApiOperation({ summary: 'List own loan applications' })
  @ApiResponse({ status: 200, description: 'Own application list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findMine(
    @Req() request: AuthenticatedRequest,
  ): Promise<LoanApplicationResponse[]> {
    return this.loanApplicationsService.findMine(request.user.id);
  }

  @Get(':id')
  @Permission(PERMISSIONS.LOAN_APPLICATIONS.SELF_READ)
  @ApiOperation({ summary: 'Get one own loan application' })
  @ApiResponse({ status: 200, description: 'Application found' })
  @ApiNotFoundResponse({ description: 'Application not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findOneMine(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LoanApplicationDetailResponse> {
    return this.loanApplicationsService.findOneMine(request.user.id, id);
  }

  @Patch(':id')
  @Permission(PERMISSIONS.LOAN_APPLICATIONS.SELF_UPDATE)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody(UPDATE_LOAN_APPLICATION_MULTIPART_BODY)
  @ApiOperation({
    summary: 'Update own loan application (optional collateral image)',
  })
  @ApiResponse({ status: 200, description: 'Application updated' })
  @ApiNotFoundResponse({ description: 'Application not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions or blocked' })
  updateMine(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLoanApplicationDto,
    @UploadedFile(optionalImageFilePipe) file?: Express.Multer.File,
  ): Promise<LoanApplicationResponse> {
    return this.loanApplicationsService.updateMine(
      request.user.id,
      id,
      dto,
      extractAuditRequestContext(request),
      file,
    );
  }

  @Delete(':id')
  @Permission(PERMISSIONS.LOAN_APPLICATIONS.SELF_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Withdraw own loan application' })
  @ApiResponse({ status: 204, description: 'Application deleted' })
  @ApiNotFoundResponse({ description: 'Application not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  deleteMine(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.loanApplicationsService.deleteMine(
      request.user.id,
      id,
      extractAuditRequestContext(request),
    );
  }
}
