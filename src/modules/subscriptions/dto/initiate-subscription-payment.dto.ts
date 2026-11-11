import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class InitiateSubscriptionPaymentDto {
  @ApiProperty({
    description: 'Active subscription plan the institution is purchasing',
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  planId!: number;

  @ApiPropertyOptional({
    maxLength: 50,
    description:
      'Optional. Omit it, or send blank, to pay the public price. A value applies only when it matches an active, unexpired coupon on this plan.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  discountCode?: string;
}
