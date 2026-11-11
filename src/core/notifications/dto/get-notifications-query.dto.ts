import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  NOTIFICATION_TYPE_VALUES,
  type NotificationType,
} from '../constants/notification-type.constant';

export class GetNotificationsQueryDto {
  @IsOptional()
  @IsIn(NOTIFICATION_TYPE_VALUES)
  type?: NotificationType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cursor?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 30;
}
