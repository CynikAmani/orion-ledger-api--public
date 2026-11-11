import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export const SUBSCRIPTION_PLAN_LIST_STATUS = {
  ALL: 'all',
  ACTIVE: 'active',
  DEACTIVATED: 'deactivated',
} as const;

export type SubscriptionPlanListStatus =
  (typeof SUBSCRIPTION_PLAN_LIST_STATUS)[keyof typeof SUBSCRIPTION_PLAN_LIST_STATUS];

export class ListSubscriptionPlansQueryDto {
  @ApiPropertyOptional({
    enum: SUBSCRIPTION_PLAN_LIST_STATUS,
    default: SUBSCRIPTION_PLAN_LIST_STATUS.ALL,
  })
  @IsOptional()
  @IsEnum(SUBSCRIPTION_PLAN_LIST_STATUS)
  status: SubscriptionPlanListStatus = SUBSCRIPTION_PLAN_LIST_STATUS.ALL;
}
