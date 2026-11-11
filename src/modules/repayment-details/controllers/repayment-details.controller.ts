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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Permission } from '../../auth/shared/decorators/permission.decorator';
import { PERMISSIONS } from '../../auth/shared/constants/permissions.constant';
import type { AuthenticatedRequest } from '../../auth/shared/guards/permission.guard';
import { resolveCallerTenantId } from '../../roles/shared/utils/resolve-caller-tenant.util';
import { TenantService } from '../../tenants/shared/services/tenant.service';
import { CreateRepaymentDetailDto } from '../dto/create-repayment-detail.dto';
import { UpdateRepaymentDetailDto } from '../dto/update-repayment-detail.dto';
import {
  RepaymentDetailsService,
  type RepaymentDetailResponse,
} from '../services/repayment-details.service';

@ApiTags('Repayment Details')
@ApiBearerAuth('bearer')
@Controller('repayment-details')
export class RepaymentDetailsController {
  constructor(
    private readonly repaymentDetailsService: RepaymentDetailsService,
    private readonly tenantService: TenantService,
  ) {}

  @Post()
  @Permission(PERMISSIONS.REPAYMENT_DETAILS.CREATE)
  @ApiOperation({
    summary:
      'Create a manual fallback repayment option for the caller\'s tenant (e.g. Mpamba, Airtel Money)',
  })
  @ApiResponse({ status: 201, description: 'Repayment detail created' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateRepaymentDetailDto,
  ): Promise<RepaymentDetailResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.repaymentDetailsService.create(tenantId, dto);
  }

  @Get('by-brand/:brandId')
  @Permission(PERMISSIONS.REPAYMENT_DETAILS.CUSTOMER_READ)
  @ApiOperation({
    summary:
      'List tenant payment methods for a brand (customer). brandId = public catalog uuid (Tenant.tenantId).',
  })
  @ApiResponse({ status: 200, description: 'Repayment method list for the brand' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Brand not found or unavailable' })
  async findByBrand(
    @Param('brandId') brandId: string,
  ): Promise<RepaymentDetailResponse[]> {
    const tenant = await this.tenantService.resolveTenantByIdentifier(brandId, {
      allowDemoWhenEnabled: true,
    });
    return this.repaymentDetailsService.findAll(tenant.tenantId);
  }

  @Get()
  @Permission(PERMISSIONS.REPAYMENT_DETAILS.READ)
  @ApiOperation({ summary: 'List repayment detail options for the caller\'s tenant' })
  @ApiResponse({ status: 200, description: 'Repayment detail list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  findAll(@Req() request: AuthenticatedRequest): Promise<RepaymentDetailResponse[]> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.repaymentDetailsService.findAll(tenantId);
  }

  @Get(':id')
  @Permission(PERMISSIONS.REPAYMENT_DETAILS.READ)
  @ApiOperation({ summary: 'Get a repayment detail by ID for the caller\'s tenant' })
  @ApiResponse({ status: 200, description: 'Repayment detail found' })
  @ApiNotFoundResponse({ description: 'Repayment detail not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<RepaymentDetailResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.repaymentDetailsService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Permission(PERMISSIONS.REPAYMENT_DETAILS.UPDATE)
  @ApiOperation({ summary: 'Update a repayment detail for the caller\'s tenant' })
  @ApiResponse({ status: 200, description: 'Repayment detail updated' })
  @ApiNotFoundResponse({ description: 'Repayment detail not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRepaymentDetailDto,
  ): Promise<RepaymentDetailResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.repaymentDetailsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Permission(PERMISSIONS.REPAYMENT_DETAILS.DELETE)
  @ApiOperation({ summary: 'Delete a repayment detail for the caller\'s tenant' })
  @ApiResponse({ status: 200, description: 'Repayment detail deleted' })
  @ApiNotFoundResponse({ description: 'Repayment detail not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    const tenantId = resolveCallerTenantId(request.user);
    await this.repaymentDetailsService.remove(tenantId, id);
    return { message: 'Repayment detail deleted successfully' };
  }
}
