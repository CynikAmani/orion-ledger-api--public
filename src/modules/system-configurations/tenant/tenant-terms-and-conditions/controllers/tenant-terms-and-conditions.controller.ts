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
import { extractAuditRequestContext } from '../../../../../core/audit/utils/audit-request-context.util';
import { PERMISSIONS } from '../../../../auth/shared/constants/permissions.constant';
import { Permission } from '../../../../auth/shared/decorators/permission.decorator';
import type { AuthenticatedRequest } from '../../../../auth/shared/guards/permission.guard';
import { resolveCallerTenantId } from '../../../../roles/shared/utils/resolve-caller-tenant.util';
import { CreateAgreementDto } from '../../../platform/terms-and-conditions/dto/create-agreement.dto';
import { ListAgreementsQueryDto } from '../../../platform/terms-and-conditions/dto/list-agreements-query.dto';
import { UpdateAgreementDto } from '../../../platform/terms-and-conditions/dto/update-agreement.dto';
import { UpdateAgreementStatusDto } from '../../../platform/terms-and-conditions/dto/update-agreement-status.dto';
import {
  TenantTermsAndConditionsService,
  type TenantAgreementResponse,
  type TenantPublicAgreementsResponse,
} from '../services/tenant-terms-and-conditions.service';

@ApiTags('System Configurations - Tenant Terms and Conditions')
@ApiBearerAuth('bearer')
@Controller('tenant/system-configurations/terms-and-conditions')
export class TenantTermsAndConditionsController {
  constructor(
    private readonly tenantTermsAndConditionsService: TenantTermsAndConditionsService,
  ) {}

  @Post()
  @Permission(PERMISSIONS.TENANT.CONFIG_UPDATE)
  @ApiOperation({
    summary: 'Create a draft terms of service or privacy policy for the tenant',
  })
  @ApiResponse({ status: 201, description: 'Agreement created as DRAFT' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or no tenant membership',
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAgreementDto,
  ): Promise<TenantAgreementResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.tenantTermsAndConditionsService.create(
      tenantId,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Get()
  @Permission(PERMISSIONS.TENANT.CONFIG_READ)
  @ApiOperation({
    summary: 'List tenant agreement versions (filter by type and/or status)',
  })
  @ApiResponse({ status: 200, description: 'Tenant agreement list' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or no tenant membership',
  })
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListAgreementsQueryDto,
  ): Promise<TenantAgreementResponse[]> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.tenantTermsAndConditionsService.findAll(tenantId, query);
  }

  @Get('current')
  @Permission(PERMISSIONS.TENANT.CONFIG_READ)
  @ApiOperation({
    summary:
      'Get the currently published Terms of Service and Privacy Policy for the tenant',
  })
  @ApiResponse({
    status: 200,
    description:
      'Active published tenant agreements (null when none is published and effective)',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or no tenant membership',
  })
  findCurrent(
    @Req() request: AuthenticatedRequest,
  ): Promise<TenantPublicAgreementsResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.tenantTermsAndConditionsService.findCurrent(tenantId);
  }

  @Get(':id')
  @Permission(PERMISSIONS.TENANT.CONFIG_READ)
  @ApiOperation({ summary: 'Get a tenant agreement version by ID' })
  @ApiResponse({ status: 200, description: 'Agreement found' })
  @ApiNotFoundResponse({ description: 'Agreement not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or no tenant membership',
  })
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TenantAgreementResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.tenantTermsAndConditionsService.findOne(tenantId, id);
  }

  @Patch(':id/status')
  @Permission(PERMISSIONS.TENANT.CONFIG_UPDATE)
  @ApiOperation({
    summary:
      'Transition tenant agreement status. Publishing archives any previously published version of the same type.',
  })
  @ApiResponse({ status: 200, description: 'Agreement status updated' })
  @ApiNotFoundResponse({ description: 'Agreement not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or no tenant membership',
  })
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAgreementStatusDto,
  ): Promise<TenantAgreementResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.tenantTermsAndConditionsService.updateStatus(
      tenantId,
      id,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Patch(':id')
  @Permission(PERMISSIONS.TENANT.CONFIG_UPDATE)
  @ApiOperation({
    summary:
      'Update a draft tenant agreement. Published/archived versions are immutable.',
  })
  @ApiResponse({ status: 200, description: 'Agreement updated' })
  @ApiNotFoundResponse({ description: 'Agreement not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or no tenant membership',
  })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAgreementDto,
  ): Promise<TenantAgreementResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.tenantTermsAndConditionsService.update(
      tenantId,
      id,
      dto,
      extractAuditRequestContext(request),
    );
  }

  @Delete(':id')
  @Permission(PERMISSIONS.TENANT.CONFIG_UPDATE)
  @ApiOperation({ summary: 'Delete a draft tenant agreement' })
  @ApiResponse({ status: 200, description: 'Agreement deleted' })
  @ApiNotFoundResponse({ description: 'Agreement not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or no tenant membership',
  })
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    const tenantId = resolveCallerTenantId(request.user);
    await this.tenantTermsAndConditionsService.remove(
      tenantId,
      id,
      extractAuditRequestContext(request),
    );
    return { message: 'Agreement deleted successfully' };
  }
}
