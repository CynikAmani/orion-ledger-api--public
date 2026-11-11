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
  StaffDashboardService,
  type StaffDashboardResponse,
} from '../services/staff-dashboard.service';

@ApiTags('Staff Dashboard')
@ApiBearerAuth('bearer')
@Controller('dashboards/staff')
export class StaffDashboardController {
  constructor(private readonly staffDashboardService: StaffDashboardService) {}

  @Get('overview')
  @Permission(PERMISSIONS.STAFF_DASHBOARD.READ)
  @ApiOperation({
    summary:
      'Staff operational overview. Slices are null unless the caller has the matching tenant:staff-dashboard:* permission.',
  })
  @ApiResponse({ status: 200, description: 'Staff dashboard overview' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getOverview(
    @Req() request: AuthenticatedRequest,
  ): Promise<StaffDashboardResponse> {
    return this.staffDashboardService.getDashboardOverview(
      request.user,
    );
  }
}
