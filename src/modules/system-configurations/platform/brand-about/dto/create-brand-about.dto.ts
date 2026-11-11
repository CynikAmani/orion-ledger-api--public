import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateBrandAboutDto {
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  brandMission?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  brandVision?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  contactPhone?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  whatsappPhone?: string;

  @ApiPropertyOptional({ maxLength: 256 })
  @IsOptional()
  @IsEmail()
  @MaxLength(256)
  contactEmail?: string;

  @ApiPropertyOptional({ maxLength: 800 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(800)
  coreValues?: string;
}
