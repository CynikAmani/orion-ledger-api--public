import { AdvertPlacement, AdvertStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAdvertDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsEnum(AdvertPlacement)
  placement?: AdvertPlacement;

  @IsOptional()
  @IsEnum(AdvertStatus)
  status?: AdvertStatus;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;
}
