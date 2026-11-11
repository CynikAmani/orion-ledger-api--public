import { describe, expect, it } from '@jest/globals';
import {
  selectDemoTenant,
  type DemoTenantCandidate,
} from './select-demo-tenant.util';

const now = new Date('2026-11-07T12:00:00.000Z');

function candidate(
  overrides: Partial<DemoTenantCandidate> &
    Pick<DemoTenantCandidate, 'tenantId'>,
): DemoTenantCandidate {
  return {
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    subscriptionStatus: 'TRIAL',
    trialEndsAt: null,
    subscriptionAccessEndsAt: null,
    loanCount: 0,
    applicationCount: 0,
    ...overrides,
  };
}

describe('selectDemoTenant', () => {
  it('picks the open demo tenant with the most loans and applications', () => {
    const selected = selectDemoTenant(
      [
        candidate({ tenantId: 'thin', loanCount: 2, applicationCount: 1 }),
        candidate({ tenantId: 'rich', loanCount: 10, applicationCount: 4 }),
        candidate({
          tenantId: 'closed',
          loanCount: 100,
          applicationCount: 100,
          subscriptionStatus: 'EXPIRED',
          trialEndsAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ],
      now,
    );

    expect(selected?.tenantId).toBe('rich');
  });

  it('breaks a tied score toward more loans, then more applications, then the oldest tenant', () => {
    const selected = selectDemoTenant(
      [
        candidate({
          tenantId: 'newer',
          loanCount: 5,
          applicationCount: 5,
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
        }),
        candidate({
          tenantId: 'older-fewer-loans',
          loanCount: 4,
          applicationCount: 6,
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
        }),
        candidate({
          tenantId: 'older-more-loans',
          loanCount: 6,
          applicationCount: 4,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        }),
      ],
      now,
    );

    expect(selected?.tenantId).toBe('older-more-loans');
  });

  it('keeps the oldest tenant when the portfolio counts match', () => {
    const selected = selectDemoTenant(
      [
        candidate({
          tenantId: 'newer',
          loanCount: 3,
          applicationCount: 3,
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
        }),
        candidate({
          tenantId: 'oldest',
          loanCount: 3,
          applicationCount: 3,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        }),
      ],
      now,
    );

    expect(selected?.tenantId).toBe('oldest');
  });

  it('returns null when every demo tenant is closed', () => {
    expect(
      selectDemoTenant(
        [
          candidate({
            tenantId: 'lapsed',
            subscriptionStatus: 'EXPIRED',
            trialEndsAt: new Date('2026-01-01T00:00:00.000Z'),
            loanCount: 8,
          }),
        ],
        now,
      ),
    ).toBeNull();
  });
});
