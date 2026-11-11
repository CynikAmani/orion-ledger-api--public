import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class IssueLoanDto {
  @ApiProperty({ description: 'Customer user id' })
  @IsString()
  customerId!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  loanAmount!: number;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  collateral!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numWeeks!: number;
}
