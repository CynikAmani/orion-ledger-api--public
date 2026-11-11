import { IsBoolean } from 'class-validator';

/** Toggles operational hold only — does not lock login. Account access uses deletedAt. */
export class SetUserBlockStatusDto {
  @IsBoolean()
  isBlocked!: boolean;
}
