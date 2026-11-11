import { DiscountType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePlanDiscountDto {
  @ApiProperty({ enum: DiscountType, example: DiscountType.PERCENTAGE })
  @IsEnum(DiscountType)
  discountType!: DiscountType;

  @ApiProperty({
    minimum: 1,
    example: 10,
    description: 'Percent points, or MWK whole units for a fixed amount',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  value!: number;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  startsAt!: Date;

  @ApiProperty({ example: '2026-10-15T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  endsAt!: Date;

  @ApiPropertyOptional({
    maxLength: 50,
    description:
      'Private coupon. Omitted discounts stay on the public schedule. Tenant plans never return this value.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;
}
