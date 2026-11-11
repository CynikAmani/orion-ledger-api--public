import { SupportTicketPriority } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateTicketPriorityDto {
  @IsEnum(SupportTicketPriority)
  priority!: SupportTicketPriority;
}
