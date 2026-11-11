import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateManagedRoleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/, {
    message:
      'key must be UPPERCASE_SNAKE_CASE with no spaces (e.g. OPERATIONS_MANAGER)',
  })
  key!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
