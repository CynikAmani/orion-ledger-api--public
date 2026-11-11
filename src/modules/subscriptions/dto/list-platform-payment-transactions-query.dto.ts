import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentTransactionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PAYMENT_TRANSACTION_INTERVALS } from '../utils/payment-transaction-interval.util';

export class ListPlatformPaymentTransactionsQueryDto {
  @ApiPropertyOptional({ enum: PaymentTransactionStatus })
  @IsOptional()
  @IsEnum(PaymentTransactionStatus)
  status?: PaymentTransactionStatus;

  @ApiPropertyOptional({ enum: PAYMENT_TRANSACTION_INTERVALS })
  @IsOptional()
  @IsIn(PAYMENT_TRANSACTION_INTERVALS)
  interval?: (typeof PAYMENT_TRANSACTION_INTERVALS)[number];

  @ApiPropertyOptional({
    description: 'Institution uuid from GET /platform/tenants',
  })
  @IsOptional()
  @IsUUID()
  uuid?: string;

  @ApiPropertyOptional({
    description: 'User id of the account that started checkout',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  initiatedById?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  planId?: number;

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
