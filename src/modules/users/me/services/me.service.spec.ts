import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MeService } from './me.service';
import { ME_AUDIT_ACTIONS } from '../constants/me-audit-actions.constant';

describe('MeService self-profile audit', () => {
  const findUniqueUser = jest.fn<(args?: unknown) => Promise<unknown>>();
  const findFirstUser = jest.fn<(args?: unknown) => Promise<unknown>>();
  const updateUser = jest.fn<(args?: unknown) => Promise<unknown>>();
  const emit = jest.fn();

  const prisma = {
    user: {
      findUnique: findUniqueUser,
      findFirst: findFirstUser,
      update: updateUser,
    },
    gender: { findUnique: jest.fn() },
    district: { findUnique: jest.fn() },
  };

  const userAccountLifecycleValidator = {
    assertUserAccountIsNotDeletedById: jest.fn(async (id: number) => ({
      id,
      userId: 'user-1',
    })),
  };

  const auditContext = {
    userId: 1,
    userEmail: 'ada@old.test',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  const existingUser = {
    userId: 'user-1',
    fullname: 'Ada',
    email: 'ada@old.test',
    phone: '111',
    nationalId: 'nid-1',
    avatarUrl: null,
    genderId: 1,
    districtId: 2,
    isBlocked: false,
    isMfaEnabled: false,
    deletedAt: null,
    genders: null,
    districts: null,
    userRoles: [],
  };

  let service: MeService;

  beforeEach(() => {
    jest.clearAllMocks();
    findUniqueUser.mockResolvedValue(existingUser);
    findFirstUser.mockResolvedValue(null);
    updateUser.mockResolvedValue({ userId: 'user-1' });

    service = new MeService(
      prisma as never,
      {} as never,
      {} as never,
      userAccountLifecycleValidator as never,
      { emit } as never,
    );
  });

  it('emits USER_PROFILE_UPDATED with previous/current pairs for changed fields', async () => {
    await service.updateProfile(
      1,
      { fullname: 'Ada Lovelace', email: 'ada@old.test', phone: '222' },
      auditContext,
      'tenant-1',
    );

    expect(emit).toHaveBeenCalledWith({
      ...auditContext,
      tenantId: 'tenant-1',
      module: 'SELF',
      action: ME_AUDIT_ACTIONS.PROFILE_UPDATED,
      targetType: 'User',
      targetId: 'user-1',
      payload: {
        previousFullname: 'Ada',
        fullname: 'Ada Lovelace',
        previousPhone: '111',
        phone: '222',
      },
    });
  });

  it('does not emit when submitted profile fields are unchanged', async () => {
    await service.updateProfile(
      1,
      { fullname: 'Ada' },
      auditContext,
      'tenant-1',
    );

    expect(emit).not.toHaveBeenCalled();
  });

  it('emits password change without secret values', async () => {
    findUniqueUser.mockResolvedValueOnce({
      password: null,
      fullname: 'Ada',
      email: null,
    });

    await service.changePassword(
      1,
      { newPassword: 'new-secret' },
      auditContext,
      'tenant-1',
    );

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        module: 'SELF',
        action: ME_AUDIT_ACTIONS.PASSWORD_CHANGED,
        targetType: 'User',
        targetId: 'user-1',
        payload: { hadPassword: false },
      }),
    );
    expect(JSON.stringify(emit.mock.calls[0]?.[0])).not.toContain('secret');
  });

  it('forbids password changes for the system master administrator', async () => {
    userAccountLifecycleValidator.assertUserAccountIsNotDeletedById.mockResolvedValueOnce(
      {
        id: 1,
        userId: 'sudo@orionloans-hub.africa',
      },
    );

    await expect(
      service.changePassword(
        1,
        { newPassword: 'new-secret' },
        auditContext,
        null,
      ),
    ).rejects.toMatchObject({
      message:
        'The system master administrator password cannot be changed from the app',
    });
    expect(updateUser).not.toHaveBeenCalled();
  });
});
