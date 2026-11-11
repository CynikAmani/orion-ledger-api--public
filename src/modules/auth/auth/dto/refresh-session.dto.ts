import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RefreshSessionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  refreshToken?: string;
}
