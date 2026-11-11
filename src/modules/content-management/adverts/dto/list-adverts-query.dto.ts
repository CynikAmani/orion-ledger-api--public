import { AdvertPlacement, AdvertStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListAdvertsQueryDto {
  @IsOptional()
  @IsEnum(AdvertStatus)
  status?: AdvertStatus;

  @IsOptional()
  @IsEnum(AdvertPlacement)
  placement?: AdvertPlacement;
}
