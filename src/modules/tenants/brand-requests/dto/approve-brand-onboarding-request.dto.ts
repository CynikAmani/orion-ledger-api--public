import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

export class ApproveBrandOnboardingRequestDto {
  @ApiPropertyOptional({
    description:
      'Trial expiry for the provisioned institution. Omit for an open-ended trial (same as manual onboard).',
    example: '2026-11-01T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  trialEndsAt?: Date;
}
