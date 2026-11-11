import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { extractAuditRequestContext } from '../../../../core/audit/utils/audit-request-context.util';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import { resolveCallerTenantId } from '../../../roles/shared/utils/resolve-caller-tenant.util';
import { CreateLoanTypeDto } from '../dto/create-loan-type.dto';
import { UpdateLoanTypeDto } from '../dto/update-loan-type.dto';
import {
  LoanTypesService,
  type LoanTypeResponse,
} from '../services/loan-types.service';

@ApiTags('Loan Types')
@ApiBearerAuth('bearer')
@Controller('loan-types')
export class LoanTypesController {
  constructor(private readonly loanTypesService: LoanTypesService) {}

  @Post()
  @Permission(PERMISSIONS.LOAN_CONFIGURATIONS.LOAN_TYPES_CREATE)
  @ApiOperation({ summary: 'Create a new loan type for the caller\'s tenant' })
  @ApiResponse({ status: 201, description: 'Loan type created' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateLoanTypeDto,
  ): Promise<LoanTypeResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loanTypesService.create(
      tenantId,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Get()
  @Permission(PERMISSIONS.LOAN_CONFIGURATIONS.LOAN_TYPES_READ)
  @ApiOperation({ summary: 'List loan types for the caller\'s tenant' })
  @ApiResponse({ status: 200, description: 'Loan type list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  findAll(@Req() request: AuthenticatedRequest): Promise<LoanTypeResponse[]> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loanTypesService.findAll(tenantId);
  }

  @Get(':id')
  @Permission(PERMISSIONS.LOAN_CONFIGURATIONS.LOAN_TYPES_READ)
  @ApiOperation({ summary: 'Get a loan type by ID for the caller\'s tenant' })
  @ApiResponse({ status: 200, description: 'Loan type found' })
  @ApiNotFoundResponse({ description: 'Loan type not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LoanTypeResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loanTypesService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Permission(PERMISSIONS.LOAN_CONFIGURATIONS.LOAN_TYPES_UPDATE)
  @ApiOperation({ summary: 'Update a loan type for the caller\'s tenant' })
  @ApiResponse({ status: 200, description: 'Loan type updated' })
  @ApiNotFoundResponse({ description: 'Loan type not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLoanTypeDto,
  ): Promise<LoanTypeResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loanTypesService.update(
      tenantId,
      id,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Delete(':id')
  @Permission(PERMISSIONS.LOAN_CONFIGURATIONS.LOAN_TYPES_DELETE)
  @ApiOperation({ summary: 'Delete a loan type for the caller\'s tenant' })
  @ApiResponse({ status: 200, description: 'Loan type deleted' })
  @ApiNotFoundResponse({ description: 'Loan type not found' })
  @ApiConflictResponse({
    description: 'Loan type has related interest rates or loans',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    const tenantId = resolveCallerTenantId(request.user);
    await this.loanTypesService.remove(
      tenantId,
      id,
      extractAuditRequestContext(request),
    );
    return { message: 'Loan type deleted successfully' };
  }
}
