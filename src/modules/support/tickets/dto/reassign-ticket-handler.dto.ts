import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReassignTicketHandlerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  handlerId!: string;
}
