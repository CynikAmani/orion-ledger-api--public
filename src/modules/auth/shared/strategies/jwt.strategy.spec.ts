import { ForbiddenException, HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const findUnique = jest.fn<(args?: unknown) => Promise<unknown>>();
  const findDemoUser = jest.fn<(args?: unknown) => Promise<unknown>>();
  const assertTenantMemberHasAssignedRoles = jest.fn();

  const prisma = {
    user: { findUnique },
    demoUser: { findUnique: findDemoUser },
  };

  const lifecycleValidator = {
    assertTenantMemberHasAssignedRoles,
  };

  let strategy: JwtStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    findDemoUser.mockResolvedValue(null);
    assertTenantMemberHasAssignedRoles.mockImplementation(() => undefined);
    process.env.JWT_SECRET = 'test-secret';
    strategy = new JwtStrategy(prisma as never, lifecycleValidator as never);
  });

  it('loads the principal from the database using only id/sub', async () => {
    findUnique.mockResolvedValue({
      id: 1,
      userId: 'active-user',
      fullname: 'Active',
      email: 'active@example.com',
      isBlocked: false,
      deletedAt: null,
      tenantId: null,
      userRoles: [],
    });

    await expect(strategy.validate({ id: 1, sub: '1' })).resolves.toEqual({
      id: 1,
      userId: 'active-user',
      fullname: 'Active',
      email: 'active@example.com',
      isBlocked: false,
      tenantId: null,
      roles: [],
      permissions: [],
      tenantContexts: [],
      subscriptionAccess: null,
    });

    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
      }),
    );
  });

  it('allows blocked users to authenticate (operational hold only)', async () => {
    findUnique.mockResolvedValue({
      id: 2,
      userId: 'blocked-user',
      fullname: 'Blocked',
      email: 'blocked@example.com',
      isBlocked: true,
      deletedAt: null,
      tenantId: null,
      userRoles: [],
    });

    await expect(strategy.validate({ id: 2, sub: '2' })).resolves.toMatchObject(
      {
        id: 2,
        userId: 'blocked-user',
        isBlocked: true,
      },
    );
  });

  it('rejects tenant members with no assigned roles', async () => {
    findUnique.mockResolvedValue({
      id: 3,
      userId: 'pending-member',
      fullname: 'Pending',
      email: 'pending@example.com',
      isBlocked: false,
      deletedAt: null,
      tenantId: 'tenant-uuid',
      userRoles: [],
    });
    assertTenantMemberHasAssignedRoles.mockImplementation(() => {
      throw new ForbiddenException(
        'Your account is registered with an organization but has no assigned role. Contact your organization administrator to request access.',
      );
    });

    await expect(strategy.validate({ id: 3, sub: '3' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects soft-deleted users even when the JWT is unexpired', async () => {
    findUnique.mockResolvedValue({
      id: 4,
      userId: 'deleted-user',
      fullname: 'Deleted',
      email: 'deleted@example.com',
      isBlocked: false,
      deletedAt: new Date('2026-01-01T00:00:00.000Z'),
      userRoles: [],
    });

    await expect(strategy.validate({ id: 4, sub: '4' })).rejects.toThrow(
      HttpException,
    );
  });

  it('rejects missing users', async () => {
    findUnique.mockResolvedValue(null);

    await expect(strategy.validate({ id: 999, sub: '999' })).rejects.toThrow(
      HttpException,
    );
  });

  it('rejects purpose-bound tokens without a database lookup', async () => {
    await expect(
      strategy.validate({ id: 1, sub: '1', purpose: 'account-access' }),
    ).rejects.toThrow(HttpException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('never trusts roles, permissions, or tenant IDs from the JWT payload', async () => {
    findUnique.mockResolvedValue({
      id: 5,
      userId: 'user-1',
      fullname: 'Staff',
      email: 'staff@example.com',
      isBlocked: false,
      deletedAt: null,
      tenantId: null,
      userRoles: [
        {
          role: {
            key: 'CUSTOMER',
            rolePermissions: [{ permission: { name: 'self:read' } }],
          },
        },
      ],
    });

    const result = await strategy.validate({
      id: 5,
      sub: '5',
      roles: ['SUPER_ADMIN'],
      permissions: ['platform:users:delete'],
      tenantId: 'forged-tenant',
    } as never);

    expect(result.id).toBe(5);
    expect(result.userId).toBe('user-1');
    expect(result.roles).toEqual(['CUSTOMER']);
    expect(result.permissions).toEqual(['self:read']);
    expect(result.tenantContexts).toEqual([]);
  });

  it('drops user and role mutations for a sandbox session', async () => {
    findUnique.mockResolvedValue({
      id: 8,
      userId: 'sandbox-1',
      fullname: 'Sandbox Admin',
      email: null,
      isBlocked: false,
      deletedAt: null,
      tenantId: 'demo-tenant',
      userRoles: [
        {
          tenantId: 'demo-tenant',
          role: {
            key: 'ADMINISTRATOR',
            tenantId: 'demo-tenant',
            rolePermissions: [
              { permission: { name: 'tenant:users:read' } },
              { permission: { name: 'tenant:users:create' } },
              { permission: { name: 'tenant:loans:read' } },
            ],
          },
        },
      ],
    });
    findDemoUser.mockResolvedValue({ userId: 8 });

    const result = await strategy.validate({ id: 8, sub: '8' });

    expect(result.permissions).toEqual([
      'tenant:users:read',
      'tenant:loans:read',
    ]);
  });

  it('keeps a demo administrator signed in after one visit has expired', async () => {
    findUnique.mockResolvedValue({
      id: 8,
      userId: 'sandbox-1',
      fullname: 'Sandbox Admin',
      email: null,
      isBlocked: false,
      deletedAt: null,
      tenantId: 'demo-tenant',
      userRoles: [
        {
          tenantId: 'demo-tenant',
          role: {
            key: 'ADMINISTRATOR',
            tenantId: 'demo-tenant',
            rolePermissions: [{ permission: { name: 'tenant:loans:read' } }],
          },
        },
      ],
    });
    findDemoUser.mockResolvedValue({ userId: 8 });

    await expect(strategy.validate({ id: 8, sub: '8' })).resolves.toMatchObject(
      {
        id: 8,
        permissions: ['tenant:loans:read'],
      },
    );
  });
});
