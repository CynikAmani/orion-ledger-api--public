export interface PlanPerformanceSnapshot {
  id: number;
  name: string;
  transactionsInitiated: number;
  successfulTransactions: number;
  activeSubscriberCount: number;
  revenue: number;
}

export function comparePlanPerformance(
  left: PlanPerformanceSnapshot,
  right: PlanPerformanceSnapshot,
): number {
  if (left.transactionsInitiated !== right.transactionsInitiated) {
    return right.transactionsInitiated - left.transactionsInitiated;
  }

  if (left.successfulTransactions !== right.successfulTransactions) {
    return right.successfulTransactions - left.successfulTransactions;
  }

  if (left.activeSubscriberCount !== right.activeSubscriberCount) {
    return right.activeSubscriberCount - left.activeSubscriberCount;
  }

  if (left.revenue !== right.revenue) {
    return right.revenue - left.revenue;
  }

  return left.name.localeCompare(right.name);
}

export function pickPlanPerformanceExtremes(plans: PlanPerformanceSnapshot[]): {
  mostPopular: PlanPerformanceSnapshot | null;
  worstPerforming: PlanPerformanceSnapshot | null;
} {
  if (plans.length === 0) {
    return { mostPopular: null, worstPerforming: null };
  }

  const ranked = [...plans].sort(comparePlanPerformance);
  return {
    mostPopular: ranked[0],
    worstPerforming: ranked.length > 1 ? ranked[ranked.length - 1] : null,
  };
}
