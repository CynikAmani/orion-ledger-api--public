import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

export class CreateInterestRateDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  loanTypeId!: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  numWeeks!: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  activeRate!: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  standardRate!: number;
}
