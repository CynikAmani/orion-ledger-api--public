import { Controller, Get, Query, Req } from '@nestjs/common';
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
  PLATFORM_DASHBOARD_DEFAULT_RANKING_LIMIT,
  PLATFORM_DASHBOARD_DEFAULT_TIMEFRAME,
} from '../constants/platform-dashboard.constant';
import { PlatformDashboardRankingsQueryDto } from '../dto/platform-dashboard-rankings-query.dto';
import { PlatformDashboardUsageQueryDto } from '../dto/platform-dashboard-usage-query.dto';
import {
  PlatformDashboardService,
  type PlatformDashboardOverviewResponse,
  type PlatformDashboardRankingsMetrics,
  type PlatformDashboardUsageMetrics,
} from '../services/platform-dashboard.service';

@ApiTags('Platform Dashboard')
@ApiBearerAuth('bearer')
@Controller('dashboards/platform')
export class PlatformDashboardController {
  constructor(
    private readonly platformDashboardService: PlatformDashboardService,
  ) {}

  @Get('overview')
  @Permission(PERMISSIONS.PLATFORM_DASHBOARD.READ)
  @ApiOperation({
    summary:
      'Platform overview. Sections are null unless the caller has the matching platform:platform-dashboard:* slice permission.',
  })
  @ApiResponse({ status: 200, description: 'Platform dashboard overview' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getOverview(
    @Req() request: AuthenticatedRequest,
  ): Promise<PlatformDashboardOverviewResponse> {
    return this.platformDashboardService.getOverview(request.user);
  }

  @Get('overview/usage')
  @Permission(PERMISSIONS.PLATFORM_DASHBOARD.USAGE)
  @ApiOperation({
    summary:
      'Platform usage volume counts for a timeframe (loan applications + loans issued)',
  })
  @ApiResponse({ status: 200, description: 'Platform usage metrics' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getUsage(
    @Query() query: PlatformDashboardUsageQueryDto,
  ): Promise<PlatformDashboardUsageMetrics> {
    return this.platformDashboardService.getUsage(
      query.timeframe ?? PLATFORM_DASHBOARD_DEFAULT_TIMEFRAME,
    );
  }

  @Get('overview/rankings')
  @Permission(PERMISSIONS.PLATFORM_DASHBOARD.RANKINGS)
  @ApiOperation({
    summary:
      'Tenant rankings by application and loan volume for a timeframe (public tenant identity + counts only)',
  })
  @ApiResponse({ status: 200, description: 'Platform tenant rankings' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getRankings(
    @Query() query: PlatformDashboardRankingsQueryDto,
  ): Promise<PlatformDashboardRankingsMetrics> {
    return this.platformDashboardService.getRankings(
      query.timeframe ?? PLATFORM_DASHBOARD_DEFAULT_TIMEFRAME,
      query.limit ?? PLATFORM_DASHBOARD_DEFAULT_RANKING_LIMIT,
    );
  }
}
