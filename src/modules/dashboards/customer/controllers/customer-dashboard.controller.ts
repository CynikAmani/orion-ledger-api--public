import { Controller, Get, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { Permission } from '../../../auth/shared/decorators/permission.decorator';
import type { AuthenticatedRequest } from '../../../auth/shared/guards/permission.guard';
import {
  CustomerDashboardService,
  type CustomerDashboardResponse,
} from '../services/customer-dashboard.service';

@ApiTags('Customer Dashboard')
@ApiBearerAuth('bearer')
@Controller('dashboards/customer')
export class CustomerDashboardController {
  constructor(
    private readonly customerDashboardService: CustomerDashboardService,
  ) {}

  @Get('overview')
  @Permission(PERMISSIONS.CUSTOMER_DASHBOARD.SELF_READ)
  @ApiOperation({
    summary:
      'Customer home overview. Slices are null unless the caller has the matching platform:customer:dashboard:* permission.',
  })
  @ApiResponse({ status: 200, description: 'Customer dashboard overview' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getOverview(
    @Req() request: AuthenticatedRequest,
  ): Promise<CustomerDashboardResponse> {
    return this.customerDashboardService.getDashboardOverview(request.user);
  }
}
