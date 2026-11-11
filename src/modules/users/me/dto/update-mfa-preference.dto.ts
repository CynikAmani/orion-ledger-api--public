import { IsBoolean } from 'class-validator';

export class UpdateMfaPreferenceDto {
  @IsBoolean()
  enabled!: boolean;
}
