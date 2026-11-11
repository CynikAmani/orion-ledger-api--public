import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DiscountType } from '@prisma/client';

export class CreateManualOfferDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customerId!: string;

  @IsEnum(DiscountType)
  discountType!: DiscountType;

  /**
   * Literal discount as the user enters it (no unit conversion).
   * PERCENTAGE: 3 means 3%. FIXED_AMOUNT: 10000 means 10000 currency units.
   */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue!: number;

  /** Custom validity window; falls back to SpecialOfferConfig.validForDays when omitted. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(3650)
  validForDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
