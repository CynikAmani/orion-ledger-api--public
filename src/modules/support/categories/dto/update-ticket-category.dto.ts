import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateTicketCategoryDto } from './create-ticket-category.dto';

export class UpdateTicketCategoryDto extends PartialType(
  OmitType(CreateTicketCategoryDto, ['key'] as const),
) {}
