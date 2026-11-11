import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RedeemOfferDto {
  /** Target loan ID (or checkout application reference persisted as loanId). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  loanId!: string;
}
