import { PartialType } from '@nestjs/swagger';
import { CreateBrandShowcaseDto } from './create-brand-showcase.dto';

export class UpdateBrandShowcaseDto extends PartialType(CreateBrandShowcaseDto) {}
