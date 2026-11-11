import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SubscriptionStatus } from '@prisma/client';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import { PlatformDashboardService } from './platform-dashboard.service';

describe('PlatformDashboardService demo tenant exclusion', () => {
  const prisma = {
    loanApplication: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    loan: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    tenant: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
  };

  let service: PlatformDashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PlatformDashboardService(prisma as never);
  });

  it('excludes demo tenants from usage counts', async () => {
    prisma.loanApplication.count.mockResolvedValue(3);
    prisma.loan.count.mockResolvedValue(2);

    await service.getUsage('all_time');

    expect(prisma.loanApplication.count).toHaveBeenCalledWith({
      where: {
        tenant: { deletedAt: null, isDemo: false },
      },
    });
    expect(prisma.loan.count).toHaveBeenCalledWith({
      where: {
        tenant: { deletedAt: null, isDemo: false },
      },
    });
  });

  it('excludes demo tenants from tenant stats', async () => {
    prisma.tenant.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);

    await service.getOverview({
      permissions: [PERMISSIONS.PLATFORM_DASHBOARD.TENANTS],
    } as never);

    expect(prisma.tenant.count).toHaveBeenCalledWith({
      where: { deletedAt: null, isDemo: false },
    });
    expect(prisma.tenant.count).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        isDemo: false,
        isActive: true,
        subscriptionStatus: SubscriptionStatus.PAID,
      },
    });
  });

  it('excludes demo tenant staff from system user totals', async () => {
    prisma.user.count.mockResolvedValue(0);

    await service.getOverview({
      permissions: [PERMISSIONS.PLATFORM_DASHBOARD.USERS],
    } as never);

    expect(prisma.user.count).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        OR: [
          { tenantId: null },
          { tenant: { deletedAt: null, isDemo: false } },
        ],
      },
    });
  });
});
