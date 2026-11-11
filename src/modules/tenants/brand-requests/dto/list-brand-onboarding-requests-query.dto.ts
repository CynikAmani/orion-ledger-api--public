import { ApiPropertyOptional } from '@nestjs/swagger';
import { OnboardingRequestStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListBrandOnboardingRequestsQueryDto {
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

  @ApiPropertyOptional({
    enum: OnboardingRequestStatus,
  })
  @IsOptional()
  @IsEnum(OnboardingRequestStatus)
  status?: OnboardingRequestStatus;
}
