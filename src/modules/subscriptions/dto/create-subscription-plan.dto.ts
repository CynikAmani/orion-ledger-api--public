import { SubscriptionBillingCycle } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSubscriptionPlanDto {
  @ApiProperty({ maxLength: 100, example: 'Monthly' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: SubscriptionBillingCycle })
  @IsEnum(SubscriptionBillingCycle)
  billingCycle!: SubscriptionBillingCycle;

  @ApiProperty({ minimum: 1, maximum: 3650, example: 30 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  durationInDays!: number;

  @ApiProperty({
    example: 30000,
    description: 'Price in MWK for future checkouts',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9_999_999_999.99)
  price!: number;
}
