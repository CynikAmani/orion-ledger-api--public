import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class SetAccountAccessPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  userId!: string;

  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
