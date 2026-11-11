import { AgreementType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAgreementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  version!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsEnum(AgreementType)
  type!: AgreementType;

  @Type(() => Date)
  @IsDate()
  effectiveDate!: Date;
}
