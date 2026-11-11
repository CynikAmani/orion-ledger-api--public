import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateBrandDetailsDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  brandName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  slogan?: string;
}
