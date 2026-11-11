import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Updates the friendly display label only. The system `key` is immutable
 * and intentionally absent — the global whitelist pipe rejects it if sent.
 */
export class UpdateManagedRoleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
