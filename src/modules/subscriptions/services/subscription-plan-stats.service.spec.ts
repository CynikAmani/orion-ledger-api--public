import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PLATFORM_PRODUCTION_TENANT_RELATION } from '../../tenants/shared/utils/platform-production-tenant.util';
import { SubscriptionPlanStatsService } from './subscription-plan-stats.service';

describe('SubscriptionPlanStatsService demo tenant exclusion', () => {
  const findOne = jest.fn<(id: number) => Promise<unknown>>();
  const count = jest.fn<(args?: unknown) => Promise<number>>();
  const groupBy = jest.fn<(args?: unknown) => Promise<unknown>>();
  const aggregate = jest.fn<(args?: unknown) => Promise<unknown>>();
  const findMany = jest.fn<(args?: unknown) => Promise<unknown>>();
  const queryRaw = jest.fn<(args?: unknown) => Promise<unknown>>();

  const prisma = {
    paymentTransaction: { count, groupBy },
    subscription: { count, groupBy, aggregate },
    subscriptionPlan: { count, findMany },
    tenant: { findMany },
    $queryRaw: queryRaw,
  };

  let service: SubscriptionPlanStatsService;

  beforeEach(() => {
    jest.clearAllMocks();
    findOne.mockResolvedValue({ id: 1 });
    count.mockResolvedValue(0);
    groupBy.mockResolvedValue([]);
    aggregate.mockResolvedValue({ _sum: { amountPaid: null } });
    findMany.mockResolvedValue([]);
    queryRaw.mockResolvedValue([{ total: 0 }]);
    service = new SubscriptionPlanStatsService(prisma as never, {
      findOne,
    } as never);
  });

  it('excludes demo tenants from per-plan transaction counts', async () => {
    await service.planStats(1);

    expect(count).toHaveBeenCalledWith({
      where: { planId: 1, ...PLATFORM_PRODUCTION_TENANT_RELATION },
    });
  });

  it('excludes demo tenants from catalog subscription and payment aggregates', async () => {
    findMany.mockResolvedValueOnce([]); // plans in loadPlanPerformance
    await service.catalogStats();

    expect(count).toHaveBeenCalledWith({
      where: PLATFORM_PRODUCTION_TENANT_RELATION,
    });
    expect(aggregate).toHaveBeenCalledWith({
      where: PLATFORM_PRODUCTION_TENANT_RELATION,
      _sum: { amountPaid: true },
    });
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: PLATFORM_PRODUCTION_TENANT_RELATION,
      }),
    );
  });
});
