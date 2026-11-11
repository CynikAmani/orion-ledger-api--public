/**
 * Notification action keys split by execution scope.
 * Stored `action_key` values use `domain:event` form for stable DB identity.
 */

/** Platform staff alerts (NotificationConfig.tenantId = null). */
export const PLATFORM_NOTIFICATION_ACTIONS = {
  SUBSCRIPTIONS: {
    CREATED: 'tenant-subscription:created',
  },
  BRAND_ONBOARDING: {
    SUBMITTED: 'brand-onboarding:submitted',
  },
  SANDBOX: {
    VISIT_STARTED: 'sandbox-session:started',
  },
} as const;

/**
 * Tenant staff alerts (NotificationConfig.tenantId = that tenant).
 * Critical loan + support ops only — not promotions / offers / agreements.
 */
export const TENANT_NOTIFICATION_ACTIONS = {
  SUPPORT: {
    TICKET_CREATED: 'support-ticket:created',
    CUSTOMER_REPLIED: 'support-ticket:customer-replied',
  },
  LOAN_APPLICATIONS: {
    SUBMITTED: 'loan-application:submitted',
  },
  LOANS: {
    ISSUED: 'loan:issued',
    OVERDUE: 'loan:overdue',
    CLEARED: 'loan:cleared',
    DEFAULTED: 'loan:defaulted',
  },
  REPAYMENTS: {
    RECORDED: 'repayment:recorded',
  },
} as const;

/**
 * @deprecated Prefer PLATFORM_NOTIFICATION_ACTIONS or TENANT_NOTIFICATION_ACTIONS.
 * Kept as a merged alias so existing domain imports keep compiling while emit sites migrate.
 */
export const NOTIFICATION_ACTIONS = {
  ...TENANT_NOTIFICATION_ACTIONS,
  // Legacy groups retained only so compile-time references in retired dispatch sites resolve.
  PROMOTIONS: {
    ACTIVATED: 'promotion:activated',
    EXPIRING_SOON: 'promotion:expiring-soon',
    CANCELLED: 'promotion:cancelled',
  },
  SPECIAL_OFFERS: {
    ISSUED_AUTOMATED: 'special-offer:issued-automated',
  },
  AGREEMENTS: {
    CREATED: 'agreement:created',
    UPDATED: 'agreement:updated',
    PUBLISHED: 'agreement:published',
    ARCHIVED: 'agreement:archived',
  },
} as const;

type NestedValueOf<T> = T extends Record<string, infer Value> ? Value : never;

export type PlatformNotificationActionKey = NestedValueOf<
  NestedValueOf<typeof PLATFORM_NOTIFICATION_ACTIONS>
>;

export type TenantNotificationActionKey = NestedValueOf<
  NestedValueOf<typeof TENANT_NOTIFICATION_ACTIONS>
>;

export type NotificationActionKey =
  | PlatformNotificationActionKey
  | TenantNotificationActionKey
  | NestedValueOf<NestedValueOf<typeof NOTIFICATION_ACTIONS>>;

export const PLATFORM_NOTIFICATION_ACTION_DESCRIPTIONS: Record<
  PlatformNotificationActionKey,
  string
> = {
  [PLATFORM_NOTIFICATION_ACTIONS.SUBSCRIPTIONS.CREATED]:
    'Sent to configured platform roles when a tenant subscription is created',
  [PLATFORM_NOTIFICATION_ACTIONS.BRAND_ONBOARDING.SUBMITTED]:
    'Sent to configured platform roles when a customer submits a brand registration request',
  [PLATFORM_NOTIFICATION_ACTIONS.SANDBOX.VISIT_STARTED]:
    'Sent to configured platform roles when a visitor starts a demo session',
};

export const TENANT_NOTIFICATION_ACTION_DESCRIPTIONS: Record<
  TenantNotificationActionKey,
  string
> = {
  [TENANT_NOTIFICATION_ACTIONS.SUPPORT.TICKET_CREATED]:
    'Sent to configured staff roles when a customer opens a support ticket',
  [TENANT_NOTIFICATION_ACTIONS.SUPPORT.CUSTOMER_REPLIED]:
    'Sent to configured staff roles when a customer replies on a support ticket',
  [TENANT_NOTIFICATION_ACTIONS.LOAN_APPLICATIONS.SUBMITTED]:
    'Sent to configured staff roles when a customer submits a loan application',
  [TENANT_NOTIFICATION_ACTIONS.LOANS.ISSUED]:
    'Sent to configured staff roles when management issues a loan',
  [TENANT_NOTIFICATION_ACTIONS.LOANS.OVERDUE]:
    'Sent to configured staff roles when a loan becomes overdue',
  [TENANT_NOTIFICATION_ACTIONS.LOANS.CLEARED]:
    'Sent to configured staff roles when a loan is fully repaid',
  [TENANT_NOTIFICATION_ACTIONS.LOANS.DEFAULTED]:
    'Sent to configured staff roles when a loan is marked defaulted',
  [TENANT_NOTIFICATION_ACTIONS.REPAYMENTS.RECORDED]:
    'Sent to configured staff roles when a loan repayment is recorded',
};

export const DEFAULT_PLATFORM_NOTIFICATION_CONFIGS: ReadonlyArray<{
  actionKey: PlatformNotificationActionKey;
  description: string;
}> = (
  Object.values(PLATFORM_NOTIFICATION_ACTIONS) as Array<
    Record<string, PlatformNotificationActionKey>
  >
).flatMap((group) =>
  Object.values(group).map((actionKey) => ({
    actionKey,
    description: PLATFORM_NOTIFICATION_ACTION_DESCRIPTIONS[actionKey],
  })),
);

export const DEFAULT_TENANT_NOTIFICATION_CONFIGS: ReadonlyArray<{
  actionKey: TenantNotificationActionKey;
  description: string;
}> = (
  Object.values(TENANT_NOTIFICATION_ACTIONS) as Array<
    Record<string, TenantNotificationActionKey>
  >
).flatMap((group) =>
  Object.values(group).map((actionKey) => ({
    actionKey,
    description: TENANT_NOTIFICATION_ACTION_DESCRIPTIONS[actionKey],
  })),
);

/** @deprecated Use DEFAULT_PLATFORM_NOTIFICATION_CONFIGS for seed/platform ensureCatalog. */
export const DEFAULT_NOTIFICATION_CONFIGS =
  DEFAULT_PLATFORM_NOTIFICATION_CONFIGS;

/** Flat set of platform action keys for validation. */
export const PLATFORM_NOTIFICATION_ACTION_KEY_SET = new Set<string>(
  DEFAULT_PLATFORM_NOTIFICATION_CONFIGS.map((row) => row.actionKey),
);

/** Flat set of tenant action keys for validation. */
export const TENANT_NOTIFICATION_ACTION_KEY_SET = new Set<string>(
  DEFAULT_TENANT_NOTIFICATION_CONFIGS.map((row) => row.actionKey),
);
