import { IsBoolean } from 'class-validator';

export class UpdateOnlineRepaymentsSettingDto {
  @IsBoolean()
  enabled!: boolean;
}
