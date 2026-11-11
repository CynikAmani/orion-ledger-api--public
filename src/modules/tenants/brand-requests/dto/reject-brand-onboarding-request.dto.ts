import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectBrandOnboardingRequestDto {
  @ApiProperty({ example: 'Slug collides with an existing workspace' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  rejectionReason!: string;
}
