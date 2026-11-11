import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { PERMISSIONS } from '../../../../auth/shared/constants/permissions.constant';
import { Permission } from '../../../../auth/shared/decorators/permission.decorator';
import {
  PlatformTenantConfigAuditService,
  type PlatformTenantConfigAuditResponse,
} from '../services/platform-tenant-config-audit.service';

@ApiTags('Tenants - Platform Config Audit')
@ApiBearerAuth('bearer')
@Controller('platform/tenants')
export class PlatformTenantConfigAuditController {
  constructor(
    private readonly platformTenantConfigAuditService: PlatformTenantConfigAuditService,
  ) {}

  @Get(':uuid/system-configurations')
  @Permission(PERMISSIONS.PLATFORM.TENANTS_CONFIG_READ)
  @ApiOperation({
    summary:
      'Read-only audit of a tenant\'s system configuration (brand, about, full T&C history)',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant system configuration audit snapshot',
  })
  @ApiNotFoundResponse({ description: 'Tenant not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getSystemConfigurations(
    @Param('uuid') uuid: string,
  ): Promise<PlatformTenantConfigAuditResponse> {
    return this.platformTenantConfigAuditService.getByTenantUuid(uuid);
  }
}
