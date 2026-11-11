import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateLoanDto {
  @ApiProperty({ description: 'Loan type (displayed as loan name)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  loanTypeId!: number;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  loanAmount!: number;

  @ApiProperty({
    description: 'Persisted interest rate snapshot (percent, whole units)',
    minimum: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  interestRate!: number;

  @ApiProperty({ maxLength: 200 })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  collateral!: string;
}
