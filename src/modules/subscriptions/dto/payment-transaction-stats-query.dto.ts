import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class PaymentTransactionStatsQueryDto {
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
}
