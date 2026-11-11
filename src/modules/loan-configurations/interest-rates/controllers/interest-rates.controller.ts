import {
  Body,
  Controller,
  Delete,
  Get,
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
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import { resolveCallerTenantId } from '../../../roles/shared/utils/resolve-caller-tenant.util';
import { TenantService } from '../../../tenants/shared/services/tenant.service';
import { ListInterestRatesQueryDto } from '../dto/list-interest-rates-query.dto';
import { SaveInterestRatesDto } from '../dto/save-interest-rates.dto';
import { UpdateInterestRateDto } from '../dto/update-interest-rate.dto';
import {
  InterestRatesService,
  type InterestRateResponse,
} from '../services/interest-rates.service';

@ApiTags('Interest Rates')
@ApiBearerAuth('bearer')
@Controller('interest-rates')
export class InterestRatesController {
  constructor(
    private readonly interestRatesService: InterestRatesService,
    private readonly tenantService: TenantService,
  ) {}

  @Post()
  @Permission(PERMISSIONS.LOAN_CONFIGURATIONS.INTEREST_RATES_CREATE)
  @ApiOperation({
    summary:
      'Save one or more interest rates for the caller\'s tenant in a single request',
  })
  @ApiResponse({
    status: 201,
    description: 'Every rate in the list was created. Nothing is stored on failure.',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SaveInterestRatesDto,
  ): Promise<InterestRateResponse[]> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.interestRatesService.create(
      tenantId,
      dto,
      extractAuditRequestContext(request),
    );
  }

  /**
   * Customer apply-form bootstrap — rates for a brand.
   * Must be registered before GET :id.
   */
  @Get('by-brand/:brandId')
  @Permission(PERMISSIONS.LOAN_CONFIGURATIONS.INTEREST_RATES_CUSTOMER_READ)
  @ApiOperation({
    summary:
      'List interest rates for a brand (customer apply form). brandId = public catalog uuid.',
  })
  @ApiResponse({ status: 200, description: 'Interest rate list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Brand not found or unavailable' })
  async findByBrand(
    @Param('brandId') brandId: string,
    @Query() query: ListInterestRatesQueryDto,
  ): Promise<InterestRateResponse[]> {
    const tenant = await this.tenantService.resolveTenantByIdentifier(brandId, {
      allowDemoWhenEnabled: true,
    });
    return this.interestRatesService.findAll(tenant.tenantId, query);
  }

  @Get()
  @Permission(PERMISSIONS.LOAN_CONFIGURATIONS.INTEREST_RATES_READ)
  @ApiOperation({
    summary:
      'List interest rates for the caller\'s tenant (optionally by loanTypeId)',
  })
  @ApiResponse({ status: 200, description: 'Interest rate list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListInterestRatesQueryDto,
  ): Promise<InterestRateResponse[]> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.interestRatesService.findAll(tenantId, query);
  }

  @Get(':id')
  @Permission(PERMISSIONS.LOAN_CONFIGURATIONS.INTEREST_RATES_READ)
  @ApiOperation({
    summary: 'Get an interest rate by ID for the caller\'s tenant',
  })
  @ApiResponse({ status: 200, description: 'Interest rate found' })
  @ApiNotFoundResponse({ description: 'Interest rate not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<InterestRateResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.interestRatesService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Permission(PERMISSIONS.LOAN_CONFIGURATIONS.INTEREST_RATES_UPDATE)
  @ApiOperation({ summary: 'Update an interest rate for the caller\'s tenant' })
  @ApiResponse({ status: 200, description: 'Interest rate updated' })
  @ApiNotFoundResponse({ description: 'Interest rate not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInterestRateDto,
  ): Promise<InterestRateResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.interestRatesService.update(
      tenantId,
      id,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Delete(':id')
  @Permission(PERMISSIONS.LOAN_CONFIGURATIONS.INTEREST_RATES_DELETE)
  @ApiOperation({ summary: 'Delete an interest rate for the caller\'s tenant' })
  @ApiResponse({ status: 200, description: 'Interest rate deleted' })
  @ApiNotFoundResponse({ description: 'Interest rate not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    const tenantId = resolveCallerTenantId(request.user);
    await this.interestRatesService.remove(
      tenantId,
      id,
      extractAuditRequestContext(request),
    );
    return { message: 'Interest rate deleted successfully' };
  }
}
