import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
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
import { UpdateTenantBrandAboutDto } from '../dto/update-tenant-brand-about.dto';
import {
  TenantBrandAboutService,
  type TenantBrandAboutResponse,
  type UpdateTenantBrandAboutResponse,
} from '../services/tenant-brand-about.service';

@ApiTags('System Configurations - Tenant Brand About')
@ApiBearerAuth('bearer')
@Controller('tenant/system-configurations/about')
export class TenantBrandAboutController {
  constructor(
    private readonly tenantBrandAboutService: TenantBrandAboutService,
  ) {}

  @Get()
  @Permission(PERMISSIONS.TENANT.CONFIG_READ)
  @ApiOperation({ summary: 'Get brand about details for the caller\'s tenant' })
  @ApiResponse({ status: 200, description: 'Tenant brand about details' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or no tenant membership',
  })
  getAboutDetails(
    @Req() request: AuthenticatedRequest,
  ): Promise<TenantBrandAboutResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.tenantBrandAboutService.getAboutDetails(tenantId);
  }

  @Patch()
  @Permission(PERMISSIONS.TENANT.CONFIG_UPDATE)
  @ApiOperation({
    summary: 'Update brand about details for the caller\'s tenant',
  })
  @ApiResponse({ status: 200, description: 'Tenant brand about details updated' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions or no tenant membership',
  })
  updateAboutDetails(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateTenantBrandAboutDto,
  ): Promise<UpdateTenantBrandAboutResponse> {
    const tenantId = resolveCallerTenantId(request.user);
    return this.tenantBrandAboutService.updateAboutDetails(
      tenantId,
      dto,
      extractAuditRequestContext(request),
    );
  }
}
