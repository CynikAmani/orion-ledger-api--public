import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalEntityType, ApprovalRequestStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  TENANT_SLUG_MESSAGE,
  TENANT_SLUG_PATTERN,
} from '../../../tenants/shared/constants/tenant-identifier.constant';

export class CreateTenantApprovalRequestDto {
  @ApiPropertyOptional({ example: 'acme-finance' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(TENANT_SLUG_PATTERN, { message: TENANT_SLUG_MESSAGE })
  slug?: string;

  @ApiPropertyOptional({ example: 'Acme Finance' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class RejectApprovalRequestDto {
  @ApiProperty({ example: 'Slug collides with an existing workspace' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  rejectionReason!: string;
}

export class ListApprovalRequestsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({
    enum: ApprovalRequestStatus,
    default: ApprovalRequestStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(ApprovalRequestStatus)
  status?: ApprovalRequestStatus;

  @ApiPropertyOptional({ enum: ApprovalEntityType })
  @IsOptional()
  @IsEnum(ApprovalEntityType)
  entityType?: ApprovalEntityType;
}
