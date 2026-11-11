import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum ManagedUserListStatus {
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
  DELETED = 'DELETED',
}

function parseRolePublicIds(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const rawValues = Array.isArray(value)
    ? value.flatMap((entry) => String(entry).split(','))
    : String(value).split(',');

  const rolePublicIds = rawValues
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return rolePublicIds.length > 0 ? rolePublicIds : undefined;
}

export class ListManagedUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => parseRolePublicIds(value))
  @IsArray()
  @IsString({ each: true })
  rolePublicIds?: string[];

  @IsOptional()
  @IsEnum(ManagedUserListStatus)
  status?: ManagedUserListStatus;
}
