import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
  Min,
} from 'class-validator';
import { DiscountType } from '@prisma/client';

export class UpdateOfferConfigDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  loanInterval?: number;

  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  /**
   * Literal discount as the user enters it (no unit conversion).
   * PERCENTAGE: 3 means 3%. FIXED_AMOUNT: 10000 means 10000 currency units.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(3650)
  validForDays?: number;

  @IsOptional()
  @IsBoolean()
  allowDefaultedUsers?: boolean;
}
