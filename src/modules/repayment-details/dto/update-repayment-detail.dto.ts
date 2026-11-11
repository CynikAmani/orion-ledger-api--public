import { PartialType } from '@nestjs/swagger';
import { CreateRepaymentDetailDto } from './create-repayment-detail.dto';

export class UpdateRepaymentDetailDto extends PartialType(
  CreateRepaymentDetailDto,
) {}
