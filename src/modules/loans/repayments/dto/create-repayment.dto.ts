import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CreateRepaymentDto {
  @ApiProperty({
    description: 'Amount to record (must not exceed remaining balance)',
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;
}
