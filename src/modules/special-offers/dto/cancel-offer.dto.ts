import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelOfferDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  cancellationReason!: string;
}
