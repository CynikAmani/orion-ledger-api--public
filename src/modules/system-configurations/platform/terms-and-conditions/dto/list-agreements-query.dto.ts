import { AgreementStatus, AgreementType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListAgreementsQueryDto {
  @IsOptional()
  @IsEnum(AgreementType)
  type?: AgreementType;

  @IsOptional()
  @IsEnum(AgreementStatus)
  status?: AgreementStatus;
}
