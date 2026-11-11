import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateLoanApplicationSettingsDto {
  @ApiPropertyOptional({
    description:
      'When true, customer self-list/detail responses include isReviewed',
  })
  @IsOptional()
  @IsBoolean()
  applicationStatusVisibleToApplicant?: boolean;

  @ApiPropertyOptional({
    description: 'Inclusive minimum loan amount (MWK whole units)',
    example: 10000,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minLoanAmount?: number;

  @ApiPropertyOptional({
    description: 'Inclusive maximum loan amount (MWK whole units)',
    example: 1000000,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxLoanAmount?: number;
}
