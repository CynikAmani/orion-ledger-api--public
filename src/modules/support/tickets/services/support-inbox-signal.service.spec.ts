import { SupportTicketStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import {
  SupportInboxSignalService,
  resolveSupportInboxAudience,
} from './support-inbox-signal.service';

describe('resolveSupportInboxAudience', () => {
  it('prefers the institution queue for tenant staff', () => {
    expect(
      resolveSupportInboxAudience({
        tenantId: 'tenant-1',
        permissions: [
          PERMISSIONS.SUPPORT.TENANT_READ,
          PERMISSIONS.SUPPORT.CUSTOMER_READ,
        ],
      }),
    ).toBe('tenant');
  });

  it('uses the platform queue when the user has no institution', () => {
    expect(
      resolveSupportInboxAudience({
        tenantId: null,
        permissions: [PERMISSIONS.SUPPORT.PLATFORM_READ],
      }),
    ).toBe('platform');
  });

  it('uses the customer signal when the user only reads their own tickets', () => {
    expect(
      resolveSupportInboxAudience({
        tenantId: null,
        permissions: [PERMISSIONS.SUPPORT.CUSTOMER_READ],
      }),
    ).toBe('customer');
  });
});

describe('SupportInboxSignalService.forLogin', () => {
  const count = jest.fn<(args?: unknown) => Promise<number>>();
  let service: SupportInboxSignalService;

  beforeEach(() => {
    count.mockReset();
    service = new SupportInboxSignalService({
      supportTicket: { count },
    } as never);
  });

  it('returns zeros when the user cannot read support', async () => {
    await expect(
      service.forLogin({
        userId: 1,
        tenantId: null,
        permissions: [],
      }),
    ).resolves.toEqual({
      audience: null,
      newTicketCount: 0,
      replyCount: 0,
    });
    expect(count).not.toHaveBeenCalled();
  });

  it('counts only unread staff replies for a customer', async () => {
    count.mockResolvedValue(2);

    await expect(
      service.forLogin({
        userId: 9,
        tenantId: null,
        permissions: [PERMISSIONS.SUPPORT.CUSTOMER_READ],
      }),
    ).resolves.toEqual({
      audience: 'customer',
      newTicketCount: 0,
      replyCount: 2,
    });

    expect(count).toHaveBeenCalledWith({
      where: { userId: 9, hasUnreadStaffReply: true },
    });
  });

  it('counts unassigned openings and later customer replies for a tenant queue', async () => {
    count.mockResolvedValueOnce(4).mockResolvedValueOnce(1);

    await expect(
      service.forLogin({
        userId: 3,
        tenantId: 'tenant-1',
        permissions: [PERMISSIONS.SUPPORT.TENANT_READ],
      }),
    ).resolves.toEqual({
      audience: 'tenant',
      newTicketCount: 4,
      replyCount: 1,
    });

    expect(count).toHaveBeenNthCalledWith(1, {
      where: {
        tenantId: 'tenant-1',
        status: SupportTicketStatus.OPEN,
        handlerId: null,
        hasUnreadCustomerReply: true,
      },
    });
    expect(count).toHaveBeenNthCalledWith(2, {
      where: {
        tenantId: 'tenant-1',
        status: {
          in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS],
        },
        handlerId: { not: null },
        hasUnreadCustomerReply: true,
      },
    });
  });
});
