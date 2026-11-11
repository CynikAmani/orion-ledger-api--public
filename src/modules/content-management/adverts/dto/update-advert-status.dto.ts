import { AdvertStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateAdvertStatusDto {
  @IsEnum(AdvertStatus)
  status!: AdvertStatus;
}
