import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { LOAN_STATUS_VALUES } from '../constants/loan-status.constant';

export class ListLoansQueryDto {
  @ApiPropertyOptional({ enum: LOAN_STATUS_VALUES })
  @IsOptional()
  @IsIn(LOAN_STATUS_VALUES)
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by loan type id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  loanTypeId?: number;

  @ApiPropertyOptional({
    description: 'Match loanId or customer fullname / phone / email',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
