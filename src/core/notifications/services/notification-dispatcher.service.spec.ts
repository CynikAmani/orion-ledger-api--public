import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NotificationDispatcherService } from './notification-dispatcher.service';

describe('NotificationDispatcherService', () => {
  const findFirst = jest.fn<(args?: unknown) => Promise<unknown>>();
  const findManyUsers = jest.fn<(args?: unknown) => Promise<unknown>>();
  const findManyConfigs = jest.fn<(args?: unknown) => Promise<unknown>>();
  const deleteMany = jest.fn<(args?: unknown) => Promise<unknown>>();
  const createMany = jest.fn<(args?: unknown) => Promise<unknown>>();
  const push = jest.fn();
  const send = jest.fn();
  const isEnabled = jest.fn<() => Promise<boolean>>();

  let service: NotificationDispatcherService;

  beforeEach(() => {
    jest.clearAllMocks();
    deleteMany.mockResolvedValue({ count: 0 });
    createMany.mockResolvedValue({ count: 0 });
    findManyConfigs.mockResolvedValue([]);
    isEnabled.mockResolvedValue(false);

    service = new NotificationDispatcherService(
      {
        notificationConfig: {
          findFirst,
          findMany: findManyConfigs,
          deleteMany,
          createMany,
        },
        user: { findMany: findManyUsers },
      } as never,
      { send } as never,
      { push } as never,
      { isEnabled } as never,
    );
  });

  it('skips when no config exists for the action after ensureCatalog', async () => {
    findFirst.mockResolvedValue(null);

    await service.dispatch('loan:issued', {
      subject: 'Loan issued',
      message: 'A loan was issued',
    }, { tenantId: 'tenant-1' });

    expect(push).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('writes in-app alerts but skips tenant emails when the flag is off', async () => {
    findFirst.mockResolvedValue({
      configId: 1,
      roles: [{ roleId: 10, role: { tenantId: 'tenant-1' } }],
    });
    findManyUsers.mockResolvedValue([
      { id: 5, userId: 'u-5', email: 'staff@example.com', fullname: 'Staff' },
    ]);
    isEnabled.mockResolvedValue(false);

    await service.dispatch(
      'loan:issued',
      { subject: 'Loan issued', message: 'A loan was issued' },
      { tenantId: 'tenant-1' },
    );

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUser: 5,
        content: 'A loan was issued',
      }),
    );
    expect(send).not.toHaveBeenCalled();
    expect(isEnabled).toHaveBeenCalled();
  });

  it('emails tenant staff when the flag is on', async () => {
    findFirst.mockResolvedValue({
      configId: 1,
      roles: [{ roleId: 10, role: { tenantId: 'tenant-1' } }],
    });
    findManyUsers.mockResolvedValue([
      { id: 5, userId: 'u-5', email: 'staff@example.com', fullname: 'Staff' },
    ]);
    isEnabled.mockResolvedValue(true);

    await service.dispatch(
      'loan:issued',
      { subject: 'Loan issued', message: 'A loan was issued' },
      { tenantId: 'tenant-1' },
    );

    expect(push).toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'staff@example.com',
        subject: 'Loan issued',
      }),
    );
  });

  it('always allows email for platform-scoped dispatches', async () => {
    findFirst.mockResolvedValue({
      configId: 2,
      roles: [{ roleId: 1, role: { tenantId: null } }],
    });
    findManyUsers.mockResolvedValue([
      {
        id: 1,
        userId: 'platform-1',
        email: 'ops@example.com',
        fullname: 'Ops',
      },
    ]);

    await service.dispatch('tenant-subscription:created', {
      subject: 'Tenant subscription created',
      message: 'A subscription was created',
    });

    expect(isEnabled).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ops@example.com' }),
    );
    expect(findManyUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: null }),
      }),
    );
  });

  it('scopes tenant recipient lookup to the event tenant', async () => {
    findFirst.mockResolvedValue({
      configId: 1,
      roles: [{ roleId: 10, role: { tenantId: 'tenant-1' } }],
    });
    findManyUsers.mockResolvedValue([]);

    await service.dispatch(
      'repayment:recorded',
      { subject: 'Repayment', message: 'Recorded' },
      { tenantId: 'tenant-1' },
    );

    expect(findManyUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          userRoles: {
            some: expect.objectContaining({
              roleId: { in: [10] },
              tenantId: 'tenant-1',
            }),
          },
        }),
      }),
    );
  });
});
