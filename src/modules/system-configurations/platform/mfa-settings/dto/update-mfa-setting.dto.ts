import { IsBoolean } from 'class-validator';

export class UpdateMfaSettingDto {
  @IsBoolean()
  enabled!: boolean;
}
