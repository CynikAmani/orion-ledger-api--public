import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from '@jest/globals';
import { GetAuditLogsQueryDto } from './get-audit-logs-query.dto';

describe('GetAuditLogsQueryDto', () => {
  it('parses comma-separated modules into AuditModule keys', async () => {
    const dto = plainToInstance(GetAuditLogsQueryDto, {
      modules: 'LOANS, SUPPORT',
      page: '2',
      limit: '50',
    });

    expect(dto.modules).toEqual(['LOANS', 'SUPPORT']);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects unknown module keys and oversized pages', async () => {
    const dto = plainToInstance(GetAuditLogsQueryDto, {
      modules: 'NOT_A_MODULE',
      limit: '200',
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property).sort()).toEqual([
      'limit',
      'modules',
    ]);
  });
});
