import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateRepaymentDetailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  paymentModeName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  accountName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  accountNumber!: string;
}
