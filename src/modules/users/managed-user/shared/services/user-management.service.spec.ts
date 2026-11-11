import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  SUPER_ADMIN_ROLE_KEY,
  SYSTEM_ROOT_USER_EMAIL,
  SYSTEM_ROOT_USER_ID,
} from '../../../../auth/shared/constants/roles.constant';
import { UserManagementService } from './user-management.service';

const PLATFORM_SCOPE = { kind: 'platform' as const };

describe('UserManagementService Super Admin protection', () => {
  const findFirstUserRole =
    jest.fn<(args?: unknown) => Promise<{ userId: number } | null>>();
  const findFirstUser = jest.fn<(args?: unknown) => Promise<unknown>>();
  const findUniqueUser = jest.fn<(args?: unknown) => Promise<unknown>>();
  const findManyUsers = jest.fn<(args?: unknown) => Promise<unknown[]>>();
  const findManyRoles =
    jest.fn<
      (
        args?: unknown,
      ) => Promise<
        Array<{
          roleId: number;
          publicId: string;
          key: string;
          tenantId: string | null;
        }>
      >
    >();
  const updateUser = jest.fn<(args?: unknown) => Promise<unknown>>();

  const prisma = {
    userRole: { findFirst: findFirstUserRole },
    user: {
      findFirst: findFirstUser,
      findUnique: findUniqueUser,
      findMany: findManyUsers,
      update: updateUser,
    },
    role: { findMany: findManyRoles },
  };

  const userAccountLifecycleValidator = {
    assertUserAccountIsNotDeleted: jest.fn(async (userId: string) => ({
      userId,
      email: 'user@example.com',
      fullname: 'Test User',
      isBlocked: false,
    })),
    getUserIfExists: jest.fn(async (userId: string) => ({
      userId,
      deletedAt: null,
    })),
  };

  const auditContext = {
    userId: 1,
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  let service: UserManagementService;

  beforeEach(() => {
    jest.clearAllMocks();
    findFirstUser.mockResolvedValue({ id: 99, userId: SYSTEM_ROOT_USER_ID });
    findFirstUserRole.mockResolvedValue({ userId: 99 });

    service = new UserManagementService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      userAccountLifecycleValidator as never,
    );
  });

  it('omits Super Admin from platform user lists', async () => {
    findManyUsers.mockResolvedValue([
      {
        id: 99,
        userId: SYSTEM_ROOT_USER_ID,
        fullname: 'Super Admin',
        email: SYSTEM_ROOT_USER_EMAIL,
        phone: null,
        isBlocked: false,
        deletedAt: null,
        avatarUrl: null,
        userRoles: [
          {
            role: {
              publicId: 'sa',
              key: SUPER_ADMIN_ROLE_KEY,
              name: 'Super Admin',
            },
          },
        ],
      },
      {
        id: 2,
        userId: 'staff-1',
        fullname: 'Staff',
        email: 'staff@example.com',
        phone: null,
        isBlocked: false,
        deletedAt: null,
        avatarUrl: null,
        userRoles: [
          {
            role: {
              publicId: 'role-2',
              key: 'PLATFORM_ADMIN',
              name: 'Platform Admin',
            },
          },
        ],
      },
    ]);

    const result = await service.findAll(
      PLATFORM_SCOPE,
      {
        page: 1,
        limit: 20,
      },
      1,
    );

    expect(result.data.map((user) => user.userId)).toEqual(['staff-1']);
    expect(findManyUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { tenantId: null },
            expect.objectContaining({
              userId: { not: SYSTEM_ROOT_USER_ID },
            }),
            { id: { not: 1 } },
          ],
        },
      }),
    );
  });

  it('omits the calling user from platform user lists', async () => {
    findManyUsers.mockResolvedValue([
      {
        id: 1,
        userId: 'admin-1',
        fullname: 'Caller',
        email: 'admin@example.com',
        phone: null,
        isBlocked: false,
        deletedAt: null,
        avatarUrl: null,
        userRoles: [],
      },
      {
        id: 2,
        userId: 'staff-1',
        fullname: 'Staff',
        email: 'staff@example.com',
        phone: null,
        isBlocked: false,
        deletedAt: null,
        avatarUrl: null,
        userRoles: [],
      },
    ]);

    const result = await service.findAll(
      PLATFORM_SCOPE,
      { page: 1, limit: 20 },
      1,
    );

    expect(result.data.map((user) => user.userId)).toEqual(['staff-1']);
  });

  it('returns not found when the user belongs to a tenant', async () => {
    findFirstUser.mockResolvedValue(null);

    await expect(
      service.findOne(PLATFORM_SCOPE, 'tenant-member'),
    ).rejects.toThrow(NotFoundException);

    expect(findFirstUser).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { tenantId: null },
            expect.objectContaining({
              userId: { not: SYSTEM_ROOT_USER_ID },
            }),
            { userId: 'tenant-member' },
          ],
        },
      }),
    );
  });

  it('treats Super Admin as not found on detail reads', async () => {
    await expect(
      service.findOne(PLATFORM_SCOPE, SYSTEM_ROOT_USER_ID),
    ).rejects.toThrow(NotFoundException);

    expect(findFirstUser).not.toHaveBeenCalled();
  });

  it('forbids creating a user with the reserved Super Admin identity', async () => {
    await expect(
      service.create(
        PLATFORM_SCOPE,
        {
          userId: SYSTEM_ROOT_USER_ID,
          fullname: 'Clone',
          nationalId: 'nid-1',
          rolePublicIds: ['role-2'],
        },
        auditContext,
        'http://localhost:3000',
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(findUniqueUser).not.toHaveBeenCalled();
  });

  it('forbids a caller from managing their own account', async () => {
    findUniqueUser.mockResolvedValue({ id: 1, userId: 'admin-1' });

    await expect(
      service.update(
        PLATFORM_SCOPE,
        'admin-1',
        { fullname: 'Self' },
        { ...auditContext, userId: 1 },
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(updateUser).not.toHaveBeenCalled();
  });

  it('forbids profile updates against Super Admin accounts', async () => {
    await expect(
      service.update(
        PLATFORM_SCOPE,
        SYSTEM_ROOT_USER_ID,
        { fullname: 'Hacked' },
        auditContext,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(updateUser).not.toHaveBeenCalled();
  });

  it('forbids soft-delete against Super Admin accounts', async () => {
    await expect(
      service.softDelete(PLATFORM_SCOPE, SYSTEM_ROOT_USER_ID, auditContext),
    ).rejects.toThrow(ForbiddenException);

    expect(updateUser).not.toHaveBeenCalled();
  });

  it('forbids block status changes against Super Admin accounts', async () => {
    await expect(
      service.setBlockStatus(
        PLATFORM_SCOPE,
        SYSTEM_ROOT_USER_ID,
        { isBlocked: true },
        auditContext,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(updateUser).not.toHaveBeenCalled();
  });

  it('forbids role assignment against Super Admin accounts', async () => {
    await expect(
      service.updateRoles(
        PLATFORM_SCOPE,
        SYSTEM_ROOT_USER_ID,
        { rolePublicIds: ['role-2'] },
        auditContext,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(updateUser).not.toHaveBeenCalled();
  });

  it('forbids assigning the Super Admin role to another user', async () => {
    findFirstUser.mockResolvedValue({ id: 2, userId: 'staff-1' });
    findFirstUserRole.mockResolvedValue(null);
    findUniqueUser.mockResolvedValue({
      email: 'staff@example.com',
      fullname: 'Staff',
      userRoles: [{ role: { publicId: 'role-2' } }],
    });
    findManyRoles.mockResolvedValue([
      {
        roleId: 1,
        publicId: 'role-1',
        key: SUPER_ADMIN_ROLE_KEY,
        tenantId: null,
      },
    ]);

    await expect(
      service.updateRoles(
        PLATFORM_SCOPE,
        'staff-1',
        { rolePublicIds: ['role-1'] },
        auditContext,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(updateUser).not.toHaveBeenCalled();
  });
});
