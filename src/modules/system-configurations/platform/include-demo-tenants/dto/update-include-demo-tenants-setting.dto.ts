import { IsBoolean } from 'class-validator';

export class UpdateIncludeDemoTenantsSettingDto {
  @IsBoolean()
  enabled!: boolean;
}
