import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateAdvertDto } from './create-advert.dto';

/**
 * Content fields only — lifecycle status transitions use UpdateAdvertStatusDto
 * via PATCH /content-management/adverts/:id/status.
 */
export class UpdateAdvertDto extends PartialType(
  OmitType(CreateAdvertDto, ['status'] as const),
) {}
