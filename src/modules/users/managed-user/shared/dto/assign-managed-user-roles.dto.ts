import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class AssignManagedUserRolesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  rolePublicIds!: string[];
}
