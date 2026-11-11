import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateLoanApplicationDto {
  @ApiPropertyOptional({ example: 150000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  loanAmount?: number;

  @ApiPropertyOptional({ example: 'Laptop - Dell XPS' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  collateral?: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numWeeks?: number;

  @ApiPropertyOptional({ example: 'Lilongwe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({
    description:
      'Attach offer by id, or send null/empty to detach the current offer',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === 'null' || value === null) {
      return null;
    }
    if (value === undefined) {
      return undefined;
    }
    return Number(value);
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  offerId?: number | null;
}
