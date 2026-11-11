import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateSupportTicketDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  categoryId!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  messageText!: string;

  /**
   * Public tenant uuid. Omit / null = platform-level ticket.
   * When loanId or loanApplicationId is set, must match that record's tenant (or is inferred).
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetTenantId?: string;

  /**
   * Public loan uuid (`Loan.publicId`). Stored as internal Loan.loanId FK.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  loanId?: string;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  loanApplicationId?: number;
}
