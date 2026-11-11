import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';
import {
  PLATFORM_DASHBOARD_DEFAULT_RANKING_LIMIT,
  PLATFORM_DASHBOARD_DEFAULT_TIMEFRAME,
  PLATFORM_DASHBOARD_RANKING_LIMITS,
  PLATFORM_DASHBOARD_TIMEFRAMES,
  type PlatformDashboardRankingLimit,
  type PlatformDashboardTimeframe,
} from '../constants/platform-dashboard.constant';

export class PlatformDashboardRankingsQueryDto {
  @ApiPropertyOptional({
    description:
      'UTC period for tenant ranking aggregations. Snapshot metrics are not affected.',
    enum: PLATFORM_DASHBOARD_TIMEFRAMES,
    default: PLATFORM_DASHBOARD_DEFAULT_TIMEFRAME,
  })
  @IsOptional()
  @IsIn(PLATFORM_DASHBOARD_TIMEFRAMES)
  timeframe?: PlatformDashboardTimeframe =
    PLATFORM_DASHBOARD_DEFAULT_TIMEFRAME;

  @ApiPropertyOptional({
    description: 'How many tenants to return per ranking list',
    enum: PLATFORM_DASHBOARD_RANKING_LIMITS,
    default: PLATFORM_DASHBOARD_DEFAULT_RANKING_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([...PLATFORM_DASHBOARD_RANKING_LIMITS])
  limit?: PlatformDashboardRankingLimit =
    PLATFORM_DASHBOARD_DEFAULT_RANKING_LIMIT;
}
