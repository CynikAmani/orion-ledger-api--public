import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  PLATFORM_DASHBOARD_DEFAULT_TIMEFRAME,
  PLATFORM_DASHBOARD_TIMEFRAMES,
  type PlatformDashboardTimeframe,
} from '../constants/platform-dashboard.constant';

export class PlatformDashboardUsageQueryDto {
  @ApiPropertyOptional({
    description:
      'UTC period for application/loan volume counts. Snapshot metrics are not affected.',
    enum: PLATFORM_DASHBOARD_TIMEFRAMES,
    default: PLATFORM_DASHBOARD_DEFAULT_TIMEFRAME,
  })
  @IsOptional()
  @IsIn(PLATFORM_DASHBOARD_TIMEFRAMES)
  timeframe?: PlatformDashboardTimeframe =
    PLATFORM_DASHBOARD_DEFAULT_TIMEFRAME;
}
