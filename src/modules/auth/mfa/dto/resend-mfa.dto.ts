import { IsNotEmpty, IsString } from 'class-validator';

export class ResendMfaDto {
  @IsString()
  @IsNotEmpty()
  mfaToken!: string;
}
