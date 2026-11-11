import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateTicketMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  messageText!: string;
}
