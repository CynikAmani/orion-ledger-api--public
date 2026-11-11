import { AgreementStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateAgreementStatusDto {
  @IsEnum(AgreementStatus)
  status!: AgreementStatus;
}
