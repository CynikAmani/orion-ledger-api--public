import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Max, Min } from 'class-validator';
import { LOAN_REPORTS_BORROWER_LEADERBOARD_LIMIT } from '../constants/loan-reports.constant';

export class ReportQueryDto {
  @ApiPropertyOptional({
    description: 'Inclusive period start (UTC calendar day). Do not combine with month/year.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'Inclusive period end (UTC calendar day). Requires startDate.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Calendar month 1–12. Requires year. Do not combine with startDate/endDate.',
    minimum: 1,
    maximum: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({
    description: 'Calendar year. Alone = full year; with month = that month.',
    example: 2026,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({
    description:
      'How many borrowers to include on each of topBorrowersByIssuedAmount and topBorrowersByRepaymentActivity',
    default: LOAN_REPORTS_BORROWER_LEADERBOARD_LIMIT.DEFAULT,
    minimum: 1,
    maximum: LOAN_REPORTS_BORROWER_LEADERBOARD_LIMIT.MAX,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LOAN_REPORTS_BORROWER_LEADERBOARD_LIMIT.MAX)
  borrowerLeaderboardLimit?: number;
}
