import { Get, Controller, Param, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import { resolveCallerTenantId } from '../../../roles/shared/utils/resolve-caller-tenant.util';
import { TenantLoanApplicationEligibilityService } from '../services/tenant-loan-application-eligibility.service';
import { TenantService } from '../services/tenant.service';
import type { TenantLoanApplicationEligibilityResponse } from '../utils/tenant-loan-application-eligibility.mapper';

@ApiTags('Tenants - Loan application eligibility')
@ApiBearerAuth('bearer')
@Controller()
export class TenantLoanApplicationEligibilityController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly eligibility: TenantLoanApplicationEligibilityService,
  ) {}

  @Get('tenant/loan-application-eligibility')
  @Permission(PERMISSIONS.TENANT.CONFIG_READ)
  @ApiOperation({
    summary:
      "Get whether the caller's institution is set up for loan applications (staff setup checklist)",
  })
  @ApiResponse({ status: 200, description: 'Loan application eligibility snapshot' })
  getMine(
    @Req() request: AuthenticatedRequest,
  ): Promise<TenantLoanApplicationEligibilityResponse> {
    return this.eligibility.getForRead(resolveCallerTenantId(request.user));
  }

  @Get('tenants/:tenantIdentifier/loan-application-eligibility')
  @Permission(PERMISSIONS.LOAN_APPLICATIONS.CREATE)
  @ApiOperation({
    summary:
      'Check whether a selected institution can accept a customer loan application',
  })
  @ApiResponse({ status: 200, description: 'Loan application eligibility snapshot' })
  @ApiNotFoundResponse({ description: 'Institution not found or inactive' })
  async getForCustomer(
    @Param('tenantIdentifier') tenantIdentifier: string,
  ): Promise<TenantLoanApplicationEligibilityResponse> {
    const tenant = await this.tenantService.resolveTenantByIdentifier(
      tenantIdentifier,
      { allowDemoWhenEnabled: true },
    );
    return this.eligibility.getForRead(tenant.tenantId);
  }
}
