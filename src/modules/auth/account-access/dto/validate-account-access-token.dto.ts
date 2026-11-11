import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ValidateAccountAccessTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  userId!: string;

  @IsString()
  @IsNotEmpty()
  token!: string;
}
