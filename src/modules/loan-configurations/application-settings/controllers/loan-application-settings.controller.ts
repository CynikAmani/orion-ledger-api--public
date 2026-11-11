import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
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
import { Authenticated } from '../../../auth/shared/decorators/authenticated.decorator';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import { resolveCallerTenantId } from '../../../roles/shared/utils/resolve-caller-tenant.util';
import { TenantService } from '../../../tenants/shared/services/tenant.service';
import { UpdateLoanApplicationSettingsDto } from '../dto/update-loan-application-settings.dto';
import {
  LoanApplicationSettingsService,
  type LoanAmountLimitsResponse,
  type LoanApplicationSettingsResponse,
} from '../services/loan-application-settings.service';

@ApiTags('Loan Configurations - Application Settings')
@ApiBearerAuth('bearer')
@Controller('loan-configurations/application-settings')
export class LoanApplicationSettingsController {
  constructor(
    private readonly loanApplicationSettingsService: LoanApplicationSettingsService,
    private readonly tenantService: TenantService,
  ) {}

  /**
   * Customer apply-form bootstrap — brand-scoped amount bounds.
   * Do not use resolveCallerTenantId (customers have User.tenantId = null).
   */
  @Get('amount-limits/by-brand/:brandId')
  @Permission(
    PERMISSIONS.LOAN_CONFIGURATIONS.APPLICATION_SETTINGS_AMOUNT_LIMITS_READ,
  )
  @ApiOperation({
    summary:
      'Get min/max loan amounts for a brand (customer apply form). brandId = public catalog uuid.',
  })
  @ApiResponse({ status: 200, description: 'Inclusive amount bounds' })
  @ApiNotFoundResponse({ description: 'Brand or settings not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async getAmountLimitsByBrand(
    @Param('brandId') brandId: string,
  ): Promise<LoanAmountLimitsResponse> {
    const tenant = await this.tenantService.resolveTenantByIdentifier(brandId, {
      allowDemoWhenEnabled: true,
    });
    return this.loanApplicationSettingsService.getAmountLimits(tenant.tenantId);
  }

  /** Staff — amount bounds for the caller\'s tenant membership. */
  @Get('amount-limits')
  @Authenticated()
  @ApiOperation({
    summary:
      'Get min/max loan amounts for the caller\'s tenant (staff / tenant members)',
  })
  @ApiResponse({ status: 200, description: 'Inclusive amount bounds' })
  @ApiNotFoundResponse({ description: 'Tenant settings missing' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Tenant membership required' })
  getAmountLimits(
    @Req() request: AuthenticatedRequest,
  ): Promise<LoanAmountLimitsResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loanApplicationSettingsService.getAmountLimits(tenantId);
  }

  @Get()
  @Permission(PERMISSIONS.LOAN_CONFIGURATIONS.APPLICATION_SETTINGS_READ)
  @ApiOperation({
    summary: 'Get loan application settings for the caller\'s tenant',
  })
  @ApiResponse({ status: 200, description: 'Settings' })
  @ApiNotFoundResponse({ description: 'Tenant settings missing' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  getSettings(
    @Req() request: AuthenticatedRequest,
  ): Promise<LoanApplicationSettingsResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loanApplicationSettingsService.getSettings(tenantId);
  }

  @Patch()
  @Permission(PERMISSIONS.LOAN_CONFIGURATIONS.APPLICATION_SETTINGS_UPDATE)
  @ApiOperation({
    summary:
      'Update loan application settings for the caller\'s tenant (partial; at least one field)',
  })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  @ApiNotFoundResponse({ description: 'Tenant settings missing' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or tenant membership required',
  })
  updateSettings(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateLoanApplicationSettingsDto,
  ): Promise<LoanApplicationSettingsResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.loanApplicationSettingsService.updateSettings(
      tenantId,
      dto,
      extractAuditRequestContext(request),
    );
  }
}
