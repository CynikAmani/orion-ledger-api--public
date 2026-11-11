import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketCategoryScope } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class ListTicketCategoriesQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: TicketCategoryScope,
    description:
      'Filter by contact target. PLATFORM = Orion; TENANT = institution.',
  })
  @IsOptional()
  @IsEnum(TicketCategoryScope)
  scope?: TicketCategoryScope;
}
