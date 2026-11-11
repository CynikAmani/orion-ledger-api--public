import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  ANNOUNCEMENT_LIST_STATUSES,
  type AnnouncementListStatus,
} from '../constants/announcement-lifecycle.constant';

export class ListAnnouncementsQueryDto {
  @ApiPropertyOptional({
    enum: ANNOUNCEMENT_LIST_STATUSES,
    description:
      'upcoming: not started; running: currently live; expired: past endsAt; active: not expired (upcoming + running). Omit for all.',
  })
  @IsOptional()
  @IsIn(ANNOUNCEMENT_LIST_STATUSES)
  status?: AnnouncementListStatus;
}
