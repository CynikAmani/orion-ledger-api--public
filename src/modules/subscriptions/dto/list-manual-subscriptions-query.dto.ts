import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { MANUAL_SUBSCRIPTION_PAYMENT_METHODS } from '../constants/manual-subscription-payment-methods.constant';

export class ListManualSubscriptionsQueryDto {
  @ApiPropertyOptional({ description: 'Brand uuid' })
  @IsOptional()
  @IsUUID()
  uuid?: string;

  @ApiPropertyOptional({ enum: MANUAL_SUBSCRIPTION_PAYMENT_METHODS })
  @IsOptional()
  @IsIn(MANUAL_SUBSCRIPTION_PAYMENT_METHODS)
  paymentMethod?: (typeof MANUAL_SUBSCRIPTION_PAYMENT_METHODS)[number];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
