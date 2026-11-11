import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateSubscriptionPlanStatusDto {
  @ApiProperty({
    description:
      'false stops new checkouts. Subscriptions already granted run until endsAt.',
  })
  @IsBoolean()
  isActive!: boolean;
}
