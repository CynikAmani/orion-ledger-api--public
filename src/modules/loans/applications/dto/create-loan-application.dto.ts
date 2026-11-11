import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateLoanApplicationDto {
  @ApiProperty({
    description: 'Target institution slug (e.g. abale-loans) or tenant code (e.g. ABL-001)',
    example: 'abale-loans',
  })
  @IsString()
  @IsNotEmpty()
  tenantIdentifier!: string;

  @ApiProperty({ example: 150000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  loanAmount!: number;

  @ApiPropertyOptional({ example: 'Laptop - Dell XPS' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  collateral?: string;

  @ApiProperty({ example: 4 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numWeeks!: number;

  @ApiProperty({ example: 'Lilongwe' })
  @IsString()
  @MaxLength(100)
  location!: string;

  @ApiPropertyOptional({
    description:
      'Optional special offer to attach. Discount is read server-side from the offer.',
    example: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  offerId?: number;
}
