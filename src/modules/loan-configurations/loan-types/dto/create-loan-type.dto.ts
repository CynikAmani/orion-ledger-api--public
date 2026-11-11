import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateLoanTypeDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : String(value ?? '').trim(),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  typeName!: string;
}
