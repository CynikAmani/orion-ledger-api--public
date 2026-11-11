import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketCategoryScope } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateTicketCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message:
      'key must be snake_case starting with a letter (e.g. general_inquiry)',
  })
  key!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TicketCategoryScope })
  @IsOptional()
  @IsEnum(TicketCategoryScope)
  scope?: TicketCategoryScope;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}
