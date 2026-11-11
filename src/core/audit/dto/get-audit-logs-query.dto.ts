import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  AUDIT_MODULES,
  type AuditModule,
} from '../interfaces/audit-payload.interface';

function parseQueryStringList(value: unknown): unknown {
  if (value == null || value === '') {
    return undefined;
  }

  const parts = Array.isArray(value) ? value : [value];
  const parsed = parts
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return parsed.length > 0 ? parsed : undefined;
}

export class GetAuditLogsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by target entity id' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetId?: string;

  @ApiPropertyOptional({
    description: 'Filter by target type (e.g. Loan, SpecialOffer, User, Role)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  targetType?: string;

  @ApiPropertyOptional({ description: 'Filter by actor user id' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  userId?: string;

  @ApiPropertyOptional({
    description:
      'Filter by audit module keys (comma-separated or repeated), e.g. LOANS,SUPPORT',
    type: [String],
    enum: AUDIT_MODULES,
  })
  @IsOptional()
  @Transform(({ value }) => parseQueryStringList(value))
  @IsArray()
  @IsIn(AUDIT_MODULES, { each: true })
  @ArrayUnique()
  modules?: AuditModule[];

  @ApiPropertyOptional({ description: 'Filter by exact action label' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @ApiPropertyOptional({ description: 'Inclusive createdAt lower bound (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Inclusive createdAt upper bound (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
