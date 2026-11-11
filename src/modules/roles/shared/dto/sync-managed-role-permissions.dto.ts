import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class SyncManagedRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionNames!: string[];
}
