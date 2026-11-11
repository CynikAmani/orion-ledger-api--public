import { describe, expect, it, jest } from '@jest/globals';
import { PrismaService } from '../../database/prisma.service';
import { AUDIT_DISPLAY_CATEGORIES } from '../constants/audit-display.constant';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('persists a normalized display payload for direct record callers', async () => {
    const create = jest.fn(async (_args: unknown) => ({ id: 'audit-1' }));
    const service = new AuditService({
      auditLog: { create },
    } as unknown as PrismaService);

    await service.record({
      module: 'PLATFORM',
      action: 'APPROVAL_REQUEST_SUBMITTED',
      targetType: 'ApprovalRequest',
      targetId: 'apr-1',
      payload: {
        entityType: 'TENANT',
        changes: { slug: 'acme' },
        password: 'should-not-leak',
      },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        tenantId: undefined,
        userId: undefined,
        userEmail: undefined,
        ipAddress: undefined,
        userAgent: undefined,
        module: 'PLATFORM',
        action: 'APPROVAL_REQUEST_SUBMITTED',
        targetId: 'apr-1',
        targetType: 'ApprovalRequest',
        payload: {
          display: {
            category: AUDIT_DISPLAY_CATEGORIES.APPROVAL,
            changes: [
              { field: 'slug', from: null, to: 'acme' },
              { field: 'entityType', from: null, to: 'TENANT' },
              { field: 'password', from: null, to: '[REDACTED]' },
            ],
          },
        },
      },
    });
  });

  it('lists tenant audit logs newest first with pagination meta', async () => {
    const createdAt = new Date('2026-03-01T12:00:00.000Z');
    const findMany = jest.fn(async (_args: unknown) => [
      {
        id: 'log-1',
        tenantId: 'tenant-1',
        userId: 10,
        user: { userId: 'staff-1' },
        userEmail: 'staff@example.com',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        module: 'LOANS',
        action: 'LOAN_ISSUED',
        targetId: 'loan-1',
        targetType: 'Loan',
        payload: {
          display: {
            category: 'METADATA',
            changes: [{ field: 'loanAmount', from: null, to: 1000 }],
          },
        },
        createdAt,
      },
    ]);
    const count = jest.fn(async (_args: unknown) => 21);
    const service = new AuditService({
      auditLog: { findMany, count },
    } as unknown as PrismaService);

    await expect(
      service.findForTenant('tenant-1', {
        targetId: 'loan-1',
        targetType: 'Loan',
        page: 2,
        limit: 20,
      }),
    ).resolves.toEqual({
      success: true,
      data: [
        {
          id: 'log-1',
          tenantId: 'tenant-1',
          userId: 'staff-1',
          userEmail: 'staff@example.com',
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
          module: 'LOANS',
          action: 'LOAN_ISSUED',
          targetId: 'loan-1',
          targetType: 'Loan',
          payload: {
            display: {
              category: 'METADATA',
              changes: [{ field: 'loanAmount', from: null, to: 1000 }],
            },
          },
          createdAt,
        },
      ],
      meta: { total: 21, page: 2, limit: 20, totalPages: 2 },
    });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        targetId: 'loan-1',
        targetType: 'Loan',
      },
      include: { user: { select: { userId: true } } },
      orderBy: { createdAt: 'desc' },
      skip: 20,
      take: 20,
    });
    expect(count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        targetId: 'loan-1',
        targetType: 'Loan',
      },
    });
  });

  it('lists platform audit logs without requiring tenant membership', async () => {
    const findMany = jest.fn(async (_args: unknown) => []);
    const count = jest.fn(async (_args: unknown) => 0);
    const service = new AuditService({
      auditLog: { findMany, count },
    } as unknown as PrismaService);

    await service.findForPlatform({ userId: 'platform-staff-1', page: 1, limit: 20 });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ tenantId: null }, { module: 'PLATFORM' }],
        user: { userId: 'platform-staff-1' },
      },
      include: { user: { select: { userId: true } } },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
  });
});
