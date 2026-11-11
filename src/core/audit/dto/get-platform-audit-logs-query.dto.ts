import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { GetAuditLogsQueryDto } from './get-audit-logs-query.dto';

export class GetPlatformAuditLogsQueryDto extends GetAuditLogsQueryDto {
  @ApiPropertyOptional({
    description:
      'Inspect one tenant\'s logs. Omit to list platform-owned rows (tenantId null) plus PLATFORM-module events.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tenantId?: string;
}
