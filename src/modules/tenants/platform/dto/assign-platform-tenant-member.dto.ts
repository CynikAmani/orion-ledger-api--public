import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AssignPlatformTenantMemberDto {
  @ApiProperty({
    description:
      'Existing platform user login id. User must not already belong to a tenant.',
    example: 'jane.doe',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  userId!: string;
}
