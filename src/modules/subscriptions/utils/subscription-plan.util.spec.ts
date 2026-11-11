import { describe, expect, it } from '@jest/globals';
import { decidePlanRemoval } from './subscription-plan-removal.util';
import {
  pickPlanPerformanceExtremes,
  type PlanPerformanceSnapshot,
} from './subscription-plan-performance.util';

describe('subscription plan removal', () => {
  it('deletes a plan that has never been used', () => {
    expect(decidePlanRemoval(0)).toBe('delete');
  });

  it('deactivates a plan that already has history', () => {
    expect(decidePlanRemoval(1)).toBe('deactivate');
  });
});

describe('subscription plan performance', () => {
  const monthly: PlanPerformanceSnapshot = {
    id: 1,
    name: 'Monthly',
    transactionsInitiated: 10,
    successfulTransactions: 8,
    activeSubscriberCount: 4,
    revenue: 300000,
  };
  const annual: PlanPerformanceSnapshot = {
    id: 2,
    name: 'Annual',
    transactionsInitiated: 2,
    successfulTransactions: 2,
    activeSubscriberCount: 2,
    revenue: 600000,
  };

  it('ranks the plan with more initiated transactions as most popular', () => {
    expect(pickPlanPerformanceExtremes([annual, monthly])).toEqual({
      mostPopular: monthly,
      worstPerforming: annual,
    });
  });

  it('omits a worst plan when the catalog has a single plan', () => {
    expect(pickPlanPerformanceExtremes([monthly])).toEqual({
      mostPopular: monthly,
      worstPerforming: null,
    });
  });
});
