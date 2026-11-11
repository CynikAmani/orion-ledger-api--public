import { tenantSubscriptionAllowsRequests } from '../../subscriptions/utils/subscription-access.util';

export interface DemoTenantCandidate {
  tenantId: string;
  createdAt: Date;
  subscriptionStatus: 'TRIAL' | 'PAID' | 'EXPIRED';
  trialEndsAt: Date | null;
  subscriptionAccessEndsAt: Date | null;
  loanCount: number;
  applicationCount: number;
}

/**
 * Open demo tenant with the richest portfolio.
 * Score is loans + applications, then loans, then applications, then the oldest tenant.
 */
export function selectDemoTenant(
  candidates: DemoTenantCandidate[],
  now: Date,
): DemoTenantCandidate | null {
  const open = candidates.filter((candidate) =>
    tenantSubscriptionAllowsRequests({
      now,
      subscriptionStatus: candidate.subscriptionStatus,
      trialEndsAt: candidate.trialEndsAt,
      subscriptionAccessEndsAt: candidate.subscriptionAccessEndsAt,
    }),
  );

  open.sort((left, right) => {
    const leftScore = left.loanCount + left.applicationCount;
    const rightScore = right.loanCount + right.applicationCount;

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    if (right.loanCount !== left.loanCount) {
      return right.loanCount - left.loanCount;
    }

    if (right.applicationCount !== left.applicationCount) {
      return right.applicationCount - left.applicationCount;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  });

  return open[0] ?? null;
}
