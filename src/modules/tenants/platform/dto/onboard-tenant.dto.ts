import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus, SubscriptionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class OnboardTenantRepresentativeDto {
  @ApiProperty({ example: 'jane.doe@acme-finance.com' })
  @IsEmail()
  @MaxLength(100)
  email!: string;

  @ApiProperty({ example: 'Jane' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(49)
  lastName!: string;

  @ApiProperty({
    description:
      'Login username. Used when creating a new account; ignored when linking an existing email.',
    example: 'jane.doe',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  userId!: string;

  @ApiProperty({ example: 'NAT-123-456-789' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nationalId!: string;

  @ApiPropertyOptional({ example: '+265999000111' })
  @IsOptional()
  @IsString()
  @MaxLength(14)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  genderId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  districtId?: number;
}

export class OnboardTenantDto {
  @ApiProperty({ example: 'Acme Finance' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    example: 'acme-finance',
    description: 'URL slug: lowercase letters, digits, and hyphens',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case (e.g. acme-finance)',
  })
  slug!: string;

  @ApiProperty({ example: 'ACME01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[A-Z0-9][A-Z0-9_-]*$/, {
    message:
      'tenantCode must start with a letter or digit and use only A-Z, 0-9, _ or -',
  })
  tenantCode!: string;

  @ApiPropertyOptional({
    enum: SubscriptionStatus,
    default: SubscriptionStatus.TRIAL,
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  subscriptionStatus?: SubscriptionStatus;

  @ApiPropertyOptional({ enum: PaymentStatus, default: PaymentStatus.PENDING })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({
    description:
      'When true, institution is for demos only: hidden from public lookups; included in the applicant catalog only when include_demo_tenants_enabled is on. Excluded from platform stats. Default false.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDemo?: boolean;

  @ApiPropertyOptional({
    description:
      'Trial expiry. Typically set when subscriptionStatus is TRIAL.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  trialEndsAt?: Date;

  @ApiProperty({ type: OnboardTenantRepresentativeDto })
  @ValidateNested()
  @Type(() => OnboardTenantRepresentativeDto)
  representative!: OnboardTenantRepresentativeDto;
}
