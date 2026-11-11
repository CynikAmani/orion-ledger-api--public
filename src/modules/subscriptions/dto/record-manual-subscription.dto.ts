import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { MANUAL_SUBSCRIPTION_PAYMENT_METHODS } from '../constants/manual-subscription-payment-methods.constant';

export class RecordManualSubscriptionDto {
  @ApiProperty({ description: 'Brand uuid from GET /platform/tenants' })
  @IsUUID()
  uuid!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  planId!: number;

  @ApiProperty({
    enum: MANUAL_SUBSCRIPTION_PAYMENT_METHODS,
    example: 'MANUAL_CASH',
  })
  @IsIn(MANUAL_SUBSCRIPTION_PAYMENT_METHODS)
  paymentMethod!: (typeof MANUAL_SUBSCRIPTION_PAYMENT_METHODS)[number];

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
