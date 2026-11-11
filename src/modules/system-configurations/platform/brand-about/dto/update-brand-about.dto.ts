import { PartialType } from '@nestjs/swagger';
import { CreateBrandAboutDto } from './create-brand-about.dto';

export class UpdateBrandAboutDto extends PartialType(CreateBrandAboutDto) {}
