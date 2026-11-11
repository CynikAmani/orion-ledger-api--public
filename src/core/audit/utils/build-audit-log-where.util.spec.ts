import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import {
  buildPlatformAuditLogWhere,
  buildTenantAuditLogWhere,
} from './build-audit-log-where.util';

describe('buildTenantAuditLogWhere', () => {
  it('always scopes to the caller tenant', () => {
    expect(buildTenantAuditLogWhere('tenant-1', {})).toEqual({
      tenantId: 'tenant-1',
    });
  });

  it('applies target, actor, action, and module filters together', () => {
    expect(
      buildTenantAuditLogWhere('tenant-1', {
        targetId: 'loan-1',
        targetType: 'Loan',
        userId: 'staff-1',
        action: 'LOAN_ISSUED',
        modules: ['LOANS', 'SUPPORT'],
      }),
    ).toEqual({
      tenantId: 'tenant-1',
      targetId: 'loan-1',
      targetType: 'Loan',
      user: { userId: 'staff-1' },
      action: 'LOAN_ISSUED',
      module: { in: ['LOANS', 'SUPPORT'] },
    });
  });

  it('applies an inclusive createdAt window', () => {
    expect(
      buildTenantAuditLogWhere('tenant-1', {
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-31T23:59:59.000Z',
      }),
    ).toEqual({
      tenantId: 'tenant-1',
      createdAt: {
        gte: new Date('2026-01-01T00:00:00.000Z'),
        lte: new Date('2026-01-31T23:59:59.000Z'),
      },
    });
  });

  it('rejects an inverted date window', () => {
    expect(() =>
      buildTenantAuditLogWhere('tenant-1', {
        startDate: '2026-02-01T00:00:00.000Z',
        endDate: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow(BadRequestException);
  });
});

describe('buildPlatformAuditLogWhere', () => {
  it('defaults to platform-owned rows plus PLATFORM-module events', () => {
    expect(buildPlatformAuditLogWhere({})).toEqual({
      OR: [{ tenantId: null }, { module: 'PLATFORM' }],
    });
  });

  it('inspects one tenant when tenantId is provided', () => {
    expect(
      buildPlatformAuditLogWhere({
        tenantId: 'tenant-1',
        targetType: 'Tenant',
        targetId: 'tenant-1',
      }),
    ).toEqual({
      tenantId: 'tenant-1',
      targetType: 'Tenant',
      targetId: 'tenant-1',
    });
  });
});
