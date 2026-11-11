import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';
import { BrandIdentityTextDto } from '../../../shared/dto/brand-identity-text.dto';

const BRAND_COLOR_HEX = /^#[0-9A-F]{6}$/;

/** Text identity plus institution brand color. Logo is uploaded via POST .../brand/logo. */
export class UpdateTenantBrandDetailsDto extends BrandIdentityTextDto {
  @ApiPropertyOptional({
    example: '#1E3A8A',
    description: '6-digit hex brand color stored on the tenant record',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(BRAND_COLOR_HEX, {
    message: 'brandColor must be a 6-digit hex color (e.g. #1E3A8A)',
  })
  brandColor?: string;
}
