import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateManagedUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullname!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nationalId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(14)
  phone?: string;

  @IsOptional()
  @IsInt()
  districtId?: number;

  @IsOptional()
  @IsInt()
  genderId?: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  rolePublicIds!: string[];
}
