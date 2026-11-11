import { Type } from 'class-transformer';
import { IsDate, IsInt, IsPositive, Max } from 'class-validator';

export class CreatePromotionDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(100)
  discount!: number;

  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @Type(() => Date)
  @IsDate()
  endDate!: Date;
}
