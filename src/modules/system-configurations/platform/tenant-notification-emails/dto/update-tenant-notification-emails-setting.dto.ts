import { IsBoolean } from 'class-validator';

export class UpdateTenantNotificationEmailsSettingDto {
  @IsBoolean()
  enabled!: boolean;
}
