import { PartialType } from '@nestjs/swagger';
import { CreateInterestRateDto } from './create-interest-rate.dto';

export class UpdateInterestRateDto extends PartialType(CreateInterestRateDto) {}
