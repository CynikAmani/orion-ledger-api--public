import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** Extra fields needed when deriving a loan application from an existing loan. */
export class CreateApplicationFromLoanDto {
  @ApiProperty({
    description: 'Pickup / meeting location (not stored on loan records)',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  location!: string;

  @ApiPropertyOptional({ description: 'Optional special offer to reserve' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  offerId?: number;
}
