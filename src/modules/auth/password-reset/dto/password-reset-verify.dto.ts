import {
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class PasswordResetVerifyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  identity!: string;

  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  pin!: string;
}
