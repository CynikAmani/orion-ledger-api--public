import { SubscriptionBillingCycle } from '@prisma/client';

/** Initial catalog used only when no plans exist yet. Prices are MWK. */
export const DEFAULT_SUBSCRIPTION_PLANS = [
  {
    name: 'Monthly',
    billingCycle: SubscriptionBillingCycle.MONTHLY,
    durationInDays: 30,
    price: '70000.00',
  },
  {
    name: 'Semi-Annual',
    billingCycle: SubscriptionBillingCycle.SEMI_ANNUAL,
    durationInDays: 180,
    price: '400000.00',
  },
  {
    name: 'Annual',
    billingCycle: SubscriptionBillingCycle.ANNUAL,
    durationInDays: 365,
    price: '800000.00',
  },
] as const;
