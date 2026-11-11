import { PartialType } from '@nestjs/swagger';
import { BrandAboutFieldsDto } from '../../../shared/dto/brand-about-fields.dto';

export class UpdateTenantBrandAboutDto extends PartialType(
  BrandAboutFieldsDto,
) {}
