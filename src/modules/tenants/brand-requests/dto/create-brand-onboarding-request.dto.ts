import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  TENANT_CODE_MESSAGE,
  TENANT_CODE_PATTERN,
  TENANT_SLUG_MESSAGE,
  TENANT_SLUG_PATTERN,
} from '../../shared/constants/tenant-identifier.constant';

export class CreateBrandOnboardingRequestDto {
  @ApiProperty({ example: 'Acme Finance' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  brandName!: string;

  @ApiProperty({
    example: 'acme-finance',
    description: 'URL-safe slug: lowercase letters, digits, and hyphens',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(TENANT_SLUG_PATTERN, { message: TENANT_SLUG_MESSAGE })
  slug!: string;

  @ApiProperty({
    example: 'ACME01',
    description: 'Uppercase tenant code (max 20 characters)',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(TENANT_CODE_PATTERN, { message: TENANT_CODE_MESSAGE })
  tenantCode!: string;

  @ApiProperty({ example: 'hello@acme-finance.com' })
  @IsEmail()
  @MaxLength(256)
  contactEmail!: string;

  @ApiPropertyOptional({ example: '+265999000111' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;
}
