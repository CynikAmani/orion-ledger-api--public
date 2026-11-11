import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsUUID, Min } from 'class-validator';

export class PreviewManualSubscriptionQueryDto {
  @ApiProperty({ description: 'Brand uuid from GET /platform/tenants' })
  @IsUUID()
  uuid!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  planId!: number;
}
