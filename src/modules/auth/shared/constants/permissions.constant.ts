/**
 * Canonical homes:
 * - GLOBAL — cross-cutting (own profile + inbox). Assignable on platform and tenant roles.
 * - PLATFORM — every `platform:*` string (staff, customer self-service, customer-ops).
 * - TENANT — every `tenant:*` string.
 *
 * Domain objects after TENANT are compatibility aliases (same strings) so existing
 * `PERMISSIONS.SPECIAL_OFFERS.*` / `PERMISSIONS.SELF.*` call sites keep compiling.
 */
const GLOBAL = {
  // Own-profile self-service (/me). Never use these to gate User Management
  // (use platform:users:* / tenant:users:* for that).
  SELF_VIEW: 'self:view', // Frontend: Profile / My Account nav visibility
  SELF_READ: 'self:read', // /me profile + own identity-document GET
  SELF_UPDATE: 'self:update', // /me profile, password, mfa, avatar, identity-document PUT
  SELF_DELETE: 'self:delete', // /me soft-delete own account

  // Inbox
  NOTIFICATIONS_VIEW: 'notification:view', // Inbox nav visibility
  NOTIFICATIONS_READ: 'notification:read', // List / mark-viewed own notifications
  NOTIFICATIONS_DELETE: 'notification:delete', // Delete own notifications
} as const;

const PLATFORM = {
  // --- Identity & Access Management ---
  // Tenants
  TENANTS_VIEW: 'platform:tenants:view', // Navigation / module visibility
  TENANTS_READ: 'platform:tenants:read', // List/detail of tenants + tenant-member identity-document GET
  TENANTS_CREATE: 'platform:tenants:create', // Onboard tenant + seed Administrator
  TENANTS_MANAGE: 'platform:tenants:manage', // Update, activate/deactivate tenants
  TENANTS_CONFIG_READ: 'platform:tenants:config:read', // Read-only snapshot of a tenant's configuration

  // Brand onboarding requests (customer apply → platform review)
  BRAND_REQUESTS_VIEW: 'platform:brand-requests:view', // Navigation / queue visibility
  BRAND_REQUESTS_READ: 'platform:brand-requests:read', // List/detail of brand onboarding requests
  BRAND_REQUESTS_APPROVE: 'platform:brand-requests:approve', // Approve a pending request and provision the tenant
  BRAND_REQUESTS_REJECT: 'platform:brand-requests:reject', // Reject a pending request with a reason

  // Audit logs (platform-wide rows + optional inspection of one tenant)
  AUDIT_VIEW: 'platform:audit:view', // Navigation / module visibility
  AUDIT_READ: 'platform:audit:read', // List/filter platform audit logs

  // Roles
  ROLES_VIEW: 'platform:roles:view', // Navigation / module visibility
  ROLES_READ: 'platform:roles:read', // List/detail platform roles and assigned permission names
  ROLES_CREATE: 'platform:roles:create',
  ROLES_UPDATE: 'platform:roles:update', // Display name / description only — key is immutable
  ROLES_DELETE: 'platform:roles:delete',
  ROLES_MANAGE: 'platform:roles:manage', // Replace a platform role's permission mappings (platform:* only)

  // Users (User.tenantId IS NULL)
  USERS_VIEW: 'platform:users:view', // Navigation / module visibility
  USERS_READ: 'platform:users:read', // List/detail platform staff users + identity-document GET
  USERS_CREATE: 'platform:users:create', // Provision a platform user + invitation
  USERS_UPDATE: 'platform:users:update', // Profile, avatar, recovery, restore — not tenant members
  USERS_DELETE: 'platform:users:delete', // Soft-delete (revokes account access until restored)
  USERS_BLOCK: 'platform:users:block', // Operational hold + session terminate — does not lock login
  USERS_ASSIGN_ROLES: 'platform:users:assign-roles', // Replace platform role assignments (platform roles only)

  // Approvals
  APPROVALS_READ: 'platform:approvals:read', // List/detail platform change-approval queue
  APPROVALS_MANAGE: 'platform:approvals:manage', // Approve or reject tenant change requests

  // --- Platform dashboard ---
  PLATFORM_DASHBOARD_VIEW: 'platform:platform-dashboard:view',
  PLATFORM_DASHBOARD_READ: 'platform:platform-dashboard:read',
  PLATFORM_DASHBOARD_USERS: 'platform:platform-dashboard:users', // Overview slice: users.*
  PLATFORM_DASHBOARD_TENANTS: 'platform:platform-dashboard:tenants', // Overview slice: tenantStats.*
  PLATFORM_DASHBOARD_QUEUES: 'platform:platform-dashboard:queues', // Overview slice: queues.* (approvals, tickets, pending brand onboarding)
  PLATFORM_DASHBOARD_USAGE: 'platform:platform-dashboard:usage', // Overview usage slice
  PLATFORM_DASHBOARD_RANKINGS: 'platform:platform-dashboard:rankings', // Overview rankings slice

  // Subscription catalog (platform staff). Each :view string is a UI section.
  SUBSCRIPTION_PLANS_VIEW: 'platform:subscription-plans:view', // Plans tab
  SUBSCRIPTION_PLANS_READ: 'platform:subscription-plans:read', // Plan table and plan record
  SUBSCRIPTION_PLANS_STATS_VIEW: 'platform:subscription-plans:stats:view', // Performance section
  SUBSCRIPTION_PLANS_SUBSCRIBERS_VIEW:
    'platform:subscription-plans:subscribers:view', // Active subscriber roster
  SUBSCRIPTION_PLANS_CREATE: 'platform:subscription-plans:create',
  SUBSCRIPTION_PLANS_UPDATE: 'platform:subscription-plans:update', // Name and price
  SUBSCRIPTION_PLANS_STATUS_UPDATE: 'platform:subscription-plans:status:update', // Activate / deactivate
  SUBSCRIPTION_PLANS_DELETE: 'platform:subscription-plans:delete',

  // Manual Cash / EFT subscription recording (platform staff).
  SUBSCRIPTIONS_VIEW: 'platform:subscriptions:view', // Record screen, plans, preview, history
  SUBSCRIPTIONS_RECORD: 'platform:subscriptions:record', // Save a Cash or EFT grant

  // Online payment transaction audit (platform staff).
  PAYMENT_TRANSACTIONS_VIEW: 'platform:payment-transactions:view', // Transactions tab
  PAYMENT_TRANSACTIONS_READ: 'platform:payment-transactions:read', // Transaction table and record
  PAYMENT_TRANSACTIONS_STATS_VIEW: 'platform:payment-transactions:stats:view', // Month, year, and all-time totals


  /**
   * Customer-account ops (`platform:customers:*`) — not the Customer's own
   * self-service. Also assignable on tenant roles so institution staff can
   * serve them.
   */
  CUSTOMERS_VIEW: 'platform:customers:view',
  CUSTOMERS_READ: 'platform:customers:read',
  CUSTOMERS_LOAN_ACTIVITY_READ: 'platform:customers:loan-activity:read',
  CUSTOMERS_IDENTITY_READ: 'platform:customers:identity:read',
  CUSTOMERS_ELIGIBILITY_READ: 'platform:customers:eligibility:read',

  // --- Customer self-service (platform:customer:* — own rows only) ---
  CUSTOMER_BRAND_REQUESTS_CREATE: 'platform:customer:brand-requests:create',
  CUSTOMER_BRAND_REQUESTS_SELF_READ:
    'platform:customer:brand-requests:self-read',
  CUSTOMER_BRAND_REQUESTS_SELF_UPDATE:
    'platform:customer:brand-requests:self-update',
  CUSTOMER_BRAND_REQUESTS_SELF_CANCEL:
    'platform:customer:brand-requests:self-cancel',

  CUSTOMER_APPLICATIONS_CREATE: 'platform:customer:applications:create',
  CUSTOMER_APPLICATIONS_SELF_READ: 'platform:customer:applications:self-read',
  CUSTOMER_APPLICATIONS_SELF_UPDATE:
    'platform:customer:applications:self-update',
  CUSTOMER_APPLICATIONS_SELF_DELETE:
    'platform:customer:applications:self-delete',

  CUSTOMER_LOANS_SELF_READ: 'platform:customer:loans:self-read',
  CUSTOMER_REPAYMENTS_SELF_READ: 'platform:customer:repayments:self-read',
  CUSTOMER_REPAYMENT_DETAILS_READ: 'platform:customer:repayment-details:read', // Read a tenant's payment methods by brandId
  CUSTOMER_INTEREST_RATES_READ: 'platform:customer:interest-rates:read', // Apply-form rate catalog
  CUSTOMER_LOAN_APP_SETTINGS_AMOUNT_LIMITS_READ:
    'platform:customer:loan-app-settings:amount-limits:read',

  CUSTOMER_DASHBOARD_VIEW: 'platform:customer:dashboard:view',
  CUSTOMER_DASHBOARD_SELF_READ: 'platform:customer:dashboard:self-read', // Envelope; ungranted slices are null
  CUSTOMER_DASHBOARD_ACTION_QUEUE: 'platform:customer:dashboard:action-queue',
  CUSTOMER_DASHBOARD_OWNED_PORTFOLIO:
    'platform:customer:dashboard:owned-portfolio',
  CUSTOMER_DASHBOARD_LIFETIME_ACTIVITY:
    'platform:customer:dashboard:lifetime-activity',
  CUSTOMER_DASHBOARD_USABLE_OFFERS: 'platform:customer:dashboard:usable-offers',
  CUSTOMER_DASHBOARD_PRODUCT_CATALOG:
    'platform:customer:dashboard:product-catalog',

  CUSTOMER_FAVORITES_VIEW: 'platform:customer:favorites:view',
  CUSTOMER_FAVORITES_READ: 'platform:customer:favorites:read',
  CUSTOMER_FAVORITES_MARK: 'platform:customer:favorites:mark',
  CUSTOMER_FAVORITES_UNMARK: 'platform:customer:favorites:unmark',

  CUSTOMER_SUPPORT_TICKETS_VIEW: 'platform:customer:support:tickets:view',
  CUSTOMER_SUPPORT_TICKETS_CREATE: 'platform:customer:support:tickets:create',
  CUSTOMER_SUPPORT_TICKETS_READ: 'platform:customer:support:tickets:read',
  CUSTOMER_SUPPORT_TICKETS_REPLY: 'platform:customer:support:tickets:reply',

  CUSTOMER_SPECIAL_OFFERS_VIEW: 'platform:customer:special-offers:view', // Special Offers tab nav
  CUSTOMER_SPECIAL_OFFERS_SELF_READ:
    'platform:customer:special-offers:self-read', // GET my-offers history
  CUSTOMER_SPECIAL_OFFERS_SELF_REDEEM:
    'platform:customer:special-offers:self-redeem', // POST :id/redeem
  CUSTOMER_SPECIAL_OFFERS_SELF_DISMISS:
    'platform:customer:special-offers:self-dismiss', // PATCH :id/dismiss-modal

  // --- Platform support (tickets where tenantId IS NULL) ---
  SUPPORT_TICKETS_VIEW: 'platform:support:tickets:view',
  SUPPORT_TICKETS_READ: 'platform:support:tickets:read',
  SUPPORT_TICKETS_REPLY: 'platform:support:tickets:reply',
  SUPPORT_TICKETS_UPDATE_STATUS: 'platform:support:tickets:update-status',
  SUPPORT_TICKETS_UPDATE_PRIORITY: 'platform:support:tickets:update-priority',
  SUPPORT_TICKETS_ASSIGN: 'platform:support:tickets:assign',
  SUPPORT_CATEGORIES_VIEW: 'platform:support:categories:view',
  SUPPORT_CATEGORIES_READ: 'platform:support:categories:read',
  SUPPORT_CATEGORIES_CREATE: 'platform:support:categories:create',
  SUPPORT_CATEGORIES_UPDATE: 'platform:support:categories:update',
  SUPPORT_CATEGORIES_DELETE: 'platform:support:categories:delete',

  // --- Platform configuration & content ---
  SYSTEM_CONFIGURATIONS_VIEW: 'platform:system-configurations:view', // Navigation / module visibility
  SYSTEM_CONFIGURATIONS_READ: 'platform:system-configurations:read',
  SYSTEM_CONFIGURATIONS_MANAGE: 'platform:system-configurations:manage',

  SYSTEM_CONTENT_VIEW: 'platform:system-content:view', // Navigation / module visibility
  SYSTEM_CONTENT_MANAGE_ABOUT: 'platform:system-content:manage-about', // Core values, email, phone
  SYSTEM_CONTENT_MANAGE_ADVERTS: 'platform:system-content:manage-adverts',
  SYSTEM_CONTENT_MANAGE_BRAND: 'platform:system-content:manage-brand', // Global brand assets
  SYSTEM_CONTENT_MANAGE_TNC: 'platform:system-content:manage-tnc', // T&C legal versions

  LOAN_TERM_VIEW: 'platform:loan-term:view', // Navigation / module visibility
  LOAN_TERM_READ: 'platform:loan-term:read',
  LOAN_TERM_MANAGE: 'platform:loan-term:manage',
} as const;

const TENANT = {
  // --- Identity & Access Management ---
  // Roles
  ROLES_VIEW: 'tenant:roles:view', // Navigation / module visibility
  ROLES_READ: 'tenant:roles:read', // List/detail roles in the caller's tenant (not platform roles)
  ROLES_CREATE: 'tenant:roles:create',
  ROLES_UPDATE: 'tenant:roles:update', // Display name / description only — key is immutable
  ROLES_DELETE: 'tenant:roles:delete',
  ROLES_MANAGE: 'tenant:roles:manage', // Replace a tenant role's permission mappings (tenant:* only)
  ROLES_ASSIGN: 'tenant:roles:assign', // Assign tenant-scoped roles to members of this tenant

  // Users (User.tenantId = caller's tenant)
  USERS_VIEW: 'tenant:users:view', // Navigation / module visibility
  USERS_READ: 'tenant:users:read', // List/detail members of this tenant + identity-document GET
  USERS_CREATE: 'tenant:users:create', // Provision a tenant user + invitation
  USERS_UPDATE: 'tenant:users:update', // Profile, avatar, recovery, restore — this tenant only
  USERS_DELETE: 'tenant:users:delete', // Soft-delete (revokes account access until restored)
  USERS_BLOCK: 'tenant:users:block', // Operational hold + session terminate — does not lock login
  USERS_ASSIGN_ROLES: 'tenant:users:assign-roles', // Replace tenant role assignments (this tenant's roles only)
  /**
   * Review a platform Customer profile during loan handling.
   * Does NOT grant platform User Management (platform:users:*).
   */
  PLATFORM_USERS_READ: 'tenant:platform:users:read',

  // Configuration
  CONFIG_READ: 'tenant:config:read', // Read this tenant's configuration
  CONFIG_UPDATE: 'tenant:config:update', // Update this tenant's configuration

  // Approvals
  APPROVALS_CREATE: 'tenant:approvals:create', // Submit change requests for protected tenant fields

  // --- Loan operations ---
  APPLICATIONS_VIEW: 'tenant:applications:view',
  APPLICATIONS_READ: 'tenant:applications:read',
  APPLICATIONS_DELETE: 'tenant:applications:delete',
  APPLICATIONS_DECLINE: 'tenant:applications:decline',
  APPLICATIONS_APPROVE: 'tenant:applications:approve',
  APPLICATIONS_MARK_REVIEWED: 'tenant:applications:mark-reviewed',

  LOANS_VIEW: 'tenant:loans:view',
  LOANS_CREATE: 'tenant:loans:create',
  LOANS_READ: 'tenant:loans:read',
  LOANS_UPDATE: 'tenant:loans:update', // Edit open loan terms; also default + reconcile
  LOANS_CLEAR: 'tenant:loans:clear',
  LOANS_DELETE: 'tenant:loans:delete',

  LOAN_PORTFOLIO_VIEW: 'tenant:loan-portfolio:view',
  LOAN_PORTFOLIO_READ: 'tenant:loan-portfolio:read',
  LOAN_REPORT_VIEW: 'tenant:loan-report:view',
  LOAN_REPORT_READ: 'tenant:loan-report:read',
  LOAN_INSIGHT_VIEW: 'tenant:loan-insight:view',
  LOAN_INSIGHT_READ: 'tenant:loan-insight:read',

  STAFF_DASHBOARD_VIEW: 'tenant:staff-dashboard:view',
  STAFF_DASHBOARD_READ: 'tenant:staff-dashboard:read',
  STAFF_DASHBOARD_ACTION_QUEUE: 'tenant:staff-dashboard:action-queue',
  STAFF_DASHBOARD_PORTFOLIO_RISK: 'tenant:staff-dashboard:portfolio-risk',
  STAFF_DASHBOARD_MONTH_PERFORMANCE: 'tenant:staff-dashboard:month-performance',
  STAFF_DASHBOARD_MINI_TRENDS: 'tenant:staff-dashboard:mini-trends',

  REPAYMENTS_VIEW: 'tenant:repayments:view',
  REPAYMENTS_CREATE: 'tenant:repayments:create',
  REPAYMENTS_READ: 'tenant:repayments:read',
  REPAYMENTS_DELETE: 'tenant:repayments:delete',

  REPAYMENT_DETAIL_VIEW: 'tenant:repayment-detail:view', // Institution payment methods
  REPAYMENT_DETAIL_CREATE: 'tenant:repayment-detail:create',
  REPAYMENT_DETAIL_READ: 'tenant:repayment-detail:read',
  REPAYMENT_DETAIL_UPDATE: 'tenant:repayment-detail:update',
  REPAYMENT_DETAIL_DELETE: 'tenant:repayment-detail:delete',

  LOAN_CONFIG_VIEW: 'tenant:loan-config:view', // Navigation / module visibility
  LOAN_TYPES_READ: 'tenant:loan-types:read',
  LOAN_TYPES_CREATE: 'tenant:loan-types:create',
  LOAN_TYPES_UPDATE: 'tenant:loan-types:update',
  LOAN_TYPES_DELETE: 'tenant:loan-types:delete',
  INTEREST_RATES_READ: 'tenant:interest-rates:read',
  INTEREST_RATES_CREATE: 'tenant:interest-rates:create',
  INTEREST_RATES_UPDATE: 'tenant:interest-rates:update',
  INTEREST_RATES_DELETE: 'tenant:interest-rates:delete',
  PROMOTIONS_READ: 'tenant:promotions:read',
  PROMOTIONS_CREATE: 'tenant:promotions:create',
  PROMOTIONS_CANCEL: 'tenant:promotions:cancel',
  LOAN_APP_SETTINGS_READ: 'tenant:loan-app-settings:read',
  LOAN_APP_SETTINGS_UPDATE: 'tenant:loan-app-settings:update',

  // --- Content ---
  CONTENT_MANAGEMENT_VIEW: 'tenant:content-management:view',
  ADVERTS_READ: 'tenant:adverts:read',
  ADVERTS_CREATE: 'tenant:adverts:create',
  ADVERTS_UPDATE: 'tenant:adverts:update',
  ADVERTS_DELETE: 'tenant:adverts:delete',
  ANNOUNCEMENTS_READ: 'tenant:announcements:read',
  ANNOUNCEMENTS_CREATE: 'tenant:announcements:create',
  ANNOUNCEMENTS_UPDATE: 'tenant:announcements:update',
  ANNOUNCEMENTS_DELETE: 'tenant:announcements:delete',
  BRAND_SHOWCASES_READ: 'tenant:brand-showcases:read',
  BRAND_SHOWCASES_CREATE: 'tenant:brand-showcases:create',
  BRAND_SHOWCASES_UPDATE: 'tenant:brand-showcases:update',
  BRAND_SHOWCASES_DELETE: 'tenant:brand-showcases:delete',

  SPECIAL_OFFER_VIEW: 'tenant:special-offer:view', // Staff Special Offers module nav
  SPECIAL_OFFER_CREATE: 'tenant:special-offer:create', // Manual grant
  SPECIAL_OFFER_READ: 'tenant:special-offer:read', // List/config read
  SPECIAL_OFFER_UPDATE: 'tenant:special-offer:update', // Update reward config
  SPECIAL_OFFER_DELETE: 'tenant:special-offer:delete', // Cancel an issued offer

  // --- Support (tickets where SupportTicket.tenantId = caller tenant) ---
  SUPPORT_TICKETS_VIEW: 'tenant:support:tickets:view',
  SUPPORT_TICKETS_READ: 'tenant:support:tickets:read',
  SUPPORT_TICKETS_REPLY: 'tenant:support:tickets:reply',
  SUPPORT_TICKETS_UPDATE_STATUS: 'tenant:support:tickets:update-status',
  SUPPORT_TICKETS_UPDATE_PRIORITY: 'tenant:support:tickets:update-priority',
  SUPPORT_TICKETS_ASSIGN: 'tenant:support:tickets:assign',

  // --- Savings ---
  SAVINGS_APPLICATIONS_VIEW: 'tenant:savings-application:view',
  SAVINGS_APPLICATIONS_CREATE: 'tenant:savings-application:create',
  SAVINGS_APPLICATIONS_READ: 'tenant:savings-application:read',
  SAVINGS_APPLICATIONS_UPDATE: 'tenant:savings-application:update',
  SAVINGS_APPLICATIONS_DELETE: 'tenant:savings-application:delete',
  SAVINGS_VIEW: 'tenant:saving:view',
  SAVINGS_CREATE: 'tenant:saving:create', // Open an active saving pool post-approval
  SAVINGS_READ: 'tenant:saving:read',
  SAVINGS_WITHDRAW: 'tenant:saving:withdraw',
  SAVINGS_DELETE: 'tenant:saving:delete',
  SAVINGS_CONFIG_VIEW: 'tenant:savings-config:view',
  SAVINGS_CONFIG_UPDATE: 'tenant:savings-config:update',
  SAVINGS_AUDIT_VIEW: 'tenant:savings-audit:view',
  SAVINGS_AUDIT_READ: 'tenant:savings-audit:read',

  // Audit logs (tenant-scoped AuditLog rows)
  AUDIT_VIEW: 'tenant:audit:view', // Navigation / module visibility
  AUDIT_READ: 'tenant:audit:read', // List/filter this tenant's audit logs

  // Institution subscription. :view strings are UI sections; :read loads that section.
  SUBSCRIPTION_VIEW: 'tenant:subscription:view', // Subscription area tab
  SUBSCRIPTION_PLANS_VIEW: 'tenant:subscription:plans:view', // Plan picker section
  SUBSCRIPTION_PLANS_READ: 'tenant:subscription:plans:read', // Active plan catalog
  SUBSCRIPTION_PAY: 'tenant:subscription:pay', // Start checkout
  SUBSCRIPTION_PAYMENTS_VIEW: 'tenant:subscription:payments:view', // Checkout status section
  SUBSCRIPTION_ACCESS_VIEW: 'tenant:subscription:access:view', // Current access section
  SUBSCRIPTION_HISTORY_VIEW: 'tenant:subscription:history:view', // Grant timeline section
} as const;

export const PERMISSIONS = {
  GLOBAL,
  PLATFORM,
  TENANT,

  // --- Compatibility aliases (same strings; not a third scope) ---
  NOTIFICATIONS: {
    VIEW: GLOBAL.NOTIFICATIONS_VIEW,
    READ: GLOBAL.NOTIFICATIONS_READ,
    DELETE: GLOBAL.NOTIFICATIONS_DELETE,
  },
  IDENTITY_DOCUMENTS: {
    READ: PLATFORM.CUSTOMERS_IDENTITY_READ,
  },
  LOAN_TERMS: {
    VIEW: PLATFORM.LOAN_TERM_VIEW,
    READ: PLATFORM.LOAN_TERM_READ,
    MANAGE: PLATFORM.LOAN_TERM_MANAGE,
  },
  SYSTEM_CONTENT: {
    VIEW: PLATFORM.SYSTEM_CONTENT_VIEW,
    MANAGE_ABOUT: PLATFORM.SYSTEM_CONTENT_MANAGE_ABOUT,
    MANAGE_ADVERTS: PLATFORM.SYSTEM_CONTENT_MANAGE_ADVERTS,
    MANAGE_BRAND: PLATFORM.SYSTEM_CONTENT_MANAGE_BRAND,
    MANAGE_TNC: PLATFORM.SYSTEM_CONTENT_MANAGE_TNC,
  },
  SYSTEM_CONFIGURATIONS: {
    VIEW: PLATFORM.SYSTEM_CONFIGURATIONS_VIEW,
    READ: PLATFORM.SYSTEM_CONFIGURATIONS_READ,
    MANAGE: PLATFORM.SYSTEM_CONFIGURATIONS_MANAGE,
  },
  SAVINGS_APPLICATIONS: {
    VIEW: TENANT.SAVINGS_APPLICATIONS_VIEW,
    CREATE: TENANT.SAVINGS_APPLICATIONS_CREATE,
    READ: TENANT.SAVINGS_APPLICATIONS_READ,
    UPDATE: TENANT.SAVINGS_APPLICATIONS_UPDATE,
    DELETE: TENANT.SAVINGS_APPLICATIONS_DELETE,
  },
  SAVINGS: {
    VIEW: TENANT.SAVINGS_VIEW,
    CREATE: TENANT.SAVINGS_CREATE,
    READ: TENANT.SAVINGS_READ,
    WITHDRAW: TENANT.SAVINGS_WITHDRAW,
    DELETE: TENANT.SAVINGS_DELETE,
  },
  SAVINGS_CONFIG: {
    VIEW: TENANT.SAVINGS_CONFIG_VIEW,
    UPDATE: TENANT.SAVINGS_CONFIG_UPDATE,
  },
  SAVINGS_AUDIT: {
    VIEW: TENANT.SAVINGS_AUDIT_VIEW,
    READ: TENANT.SAVINGS_AUDIT_READ,
  },

  SELF: {
    VIEW: GLOBAL.SELF_VIEW,
    READ: GLOBAL.SELF_READ,
    UPDATE: GLOBAL.SELF_UPDATE,
    DELETE: GLOBAL.SELF_DELETE,
  },
  LOAN_APPLICATIONS: {
    CREATE: PLATFORM.CUSTOMER_APPLICATIONS_CREATE,
    SELF_READ: PLATFORM.CUSTOMER_APPLICATIONS_SELF_READ,
    SELF_UPDATE: PLATFORM.CUSTOMER_APPLICATIONS_SELF_UPDATE,
    SELF_DELETE: PLATFORM.CUSTOMER_APPLICATIONS_SELF_DELETE,
    VIEW: TENANT.APPLICATIONS_VIEW,
    READ: TENANT.APPLICATIONS_READ,
    DELETE: TENANT.APPLICATIONS_DELETE,
    DECLINE: TENANT.APPLICATIONS_DECLINE,
    APPROVE: TENANT.APPLICATIONS_APPROVE,
    MARK_REVIEWED: TENANT.APPLICATIONS_MARK_REVIEWED,
  },
  LOANS: {
    SELF_READ: PLATFORM.CUSTOMER_LOANS_SELF_READ,
    VIEW: TENANT.LOANS_VIEW,
    CREATE: TENANT.LOANS_CREATE,
    READ: TENANT.LOANS_READ,
    UPDATE: TENANT.LOANS_UPDATE,
    CLEAR: TENANT.LOANS_CLEAR,
    DELETE: TENANT.LOANS_DELETE,
  },
  LOAN_PORTFOLIO: {
    VIEW: TENANT.LOAN_PORTFOLIO_VIEW,
    READ: TENANT.LOAN_PORTFOLIO_READ,
  },
  LOAN_REPORTS: {
    VIEW: TENANT.LOAN_REPORT_VIEW,
    READ: TENANT.LOAN_REPORT_READ,
  },
  LOAN_INSIGHTS: {
    VIEW: TENANT.LOAN_INSIGHT_VIEW,
    READ: TENANT.LOAN_INSIGHT_READ,
  },
  STAFF_DASHBOARD: {
    VIEW: TENANT.STAFF_DASHBOARD_VIEW,
    READ: TENANT.STAFF_DASHBOARD_READ,
    ACTION_QUEUE: TENANT.STAFF_DASHBOARD_ACTION_QUEUE,
    PORTFOLIO_RISK: TENANT.STAFF_DASHBOARD_PORTFOLIO_RISK,
    MONTH_PERFORMANCE: TENANT.STAFF_DASHBOARD_MONTH_PERFORMANCE,
    MINI_TRENDS: TENANT.STAFF_DASHBOARD_MINI_TRENDS,
  },
  CUSTOMER_DASHBOARD: {
    VIEW: PLATFORM.CUSTOMER_DASHBOARD_VIEW,
    SELF_READ: PLATFORM.CUSTOMER_DASHBOARD_SELF_READ,
    ACTION_QUEUE: PLATFORM.CUSTOMER_DASHBOARD_ACTION_QUEUE,
    OWNED_PORTFOLIO: PLATFORM.CUSTOMER_DASHBOARD_OWNED_PORTFOLIO,
    LIFETIME_ACTIVITY: PLATFORM.CUSTOMER_DASHBOARD_LIFETIME_ACTIVITY,
    USABLE_OFFERS: PLATFORM.CUSTOMER_DASHBOARD_USABLE_OFFERS,
    PRODUCT_CATALOG: PLATFORM.CUSTOMER_DASHBOARD_PRODUCT_CATALOG,
  },
  CUSTOMER_FAVORITES: {
    VIEW: PLATFORM.CUSTOMER_FAVORITES_VIEW,
    READ: PLATFORM.CUSTOMER_FAVORITES_READ,
    MARK: PLATFORM.CUSTOMER_FAVORITES_MARK,
    UNMARK: PLATFORM.CUSTOMER_FAVORITES_UNMARK,
  },
  BRAND_REQUESTS: {
    VIEW: PLATFORM.BRAND_REQUESTS_VIEW,
    READ: PLATFORM.BRAND_REQUESTS_READ,
    APPROVE: PLATFORM.BRAND_REQUESTS_APPROVE,
    REJECT: PLATFORM.BRAND_REQUESTS_REJECT,
    CREATE: PLATFORM.CUSTOMER_BRAND_REQUESTS_CREATE,
    SELF_READ: PLATFORM.CUSTOMER_BRAND_REQUESTS_SELF_READ,
    SELF_UPDATE: PLATFORM.CUSTOMER_BRAND_REQUESTS_SELF_UPDATE,
    SELF_CANCEL: PLATFORM.CUSTOMER_BRAND_REQUESTS_SELF_CANCEL,
  },
  PLATFORM_DASHBOARD: {
    VIEW: PLATFORM.PLATFORM_DASHBOARD_VIEW,
    READ: PLATFORM.PLATFORM_DASHBOARD_READ,
    USERS: PLATFORM.PLATFORM_DASHBOARD_USERS,
    TENANTS: PLATFORM.PLATFORM_DASHBOARD_TENANTS,
    QUEUES: PLATFORM.PLATFORM_DASHBOARD_QUEUES,
    USAGE: PLATFORM.PLATFORM_DASHBOARD_USAGE,
    RANKINGS: PLATFORM.PLATFORM_DASHBOARD_RANKINGS,
  },
  LOAN_ELIGIBILITY: {
    READ: PLATFORM.CUSTOMERS_ELIGIBILITY_READ,
  },
  CUSTOMERS: {
    VIEW: PLATFORM.CUSTOMERS_VIEW,
    READ: PLATFORM.CUSTOMERS_READ,
    LOAN_ACTIVITY_READ: PLATFORM.CUSTOMERS_LOAN_ACTIVITY_READ,
    IDENTITY_READ: PLATFORM.CUSTOMERS_IDENTITY_READ,
    ELIGIBILITY_READ: PLATFORM.CUSTOMERS_ELIGIBILITY_READ,
  },
  /** @deprecated Prefer CUSTOMERS.LOAN_ACTIVITY_READ — same string */
  CUSTOMER_LOAN_ACTIVITY: {
    READ: PLATFORM.CUSTOMERS_LOAN_ACTIVITY_READ,
  },
  REPAYMENTS: {
    SELF_READ: PLATFORM.CUSTOMER_REPAYMENTS_SELF_READ,
    VIEW: TENANT.REPAYMENTS_VIEW,
    CREATE: TENANT.REPAYMENTS_CREATE,
    READ: TENANT.REPAYMENTS_READ,
    DELETE: TENANT.REPAYMENTS_DELETE,
  },
  REPAYMENT_DETAILS: {
    CUSTOMER_READ: PLATFORM.CUSTOMER_REPAYMENT_DETAILS_READ,
    VIEW: TENANT.REPAYMENT_DETAIL_VIEW,
    CREATE: TENANT.REPAYMENT_DETAIL_CREATE,
    READ: TENANT.REPAYMENT_DETAIL_READ,
    UPDATE: TENANT.REPAYMENT_DETAIL_UPDATE,
    DELETE: TENANT.REPAYMENT_DETAIL_DELETE,
  },
  LOAN_CONFIGURATIONS: {
    VIEW: TENANT.LOAN_CONFIG_VIEW,
    LOAN_TYPES_READ: TENANT.LOAN_TYPES_READ,
    LOAN_TYPES_CREATE: TENANT.LOAN_TYPES_CREATE,
    LOAN_TYPES_UPDATE: TENANT.LOAN_TYPES_UPDATE,
    LOAN_TYPES_DELETE: TENANT.LOAN_TYPES_DELETE,
    INTEREST_RATES_CUSTOMER_READ: PLATFORM.CUSTOMER_INTEREST_RATES_READ,
    INTEREST_RATES_READ: TENANT.INTEREST_RATES_READ,
    INTEREST_RATES_CREATE: TENANT.INTEREST_RATES_CREATE,
    INTEREST_RATES_UPDATE: TENANT.INTEREST_RATES_UPDATE,
    INTEREST_RATES_DELETE: TENANT.INTEREST_RATES_DELETE,
    PROMOTIONS_READ: TENANT.PROMOTIONS_READ,
    PROMOTIONS_CREATE: TENANT.PROMOTIONS_CREATE,
    PROMOTIONS_CANCEL: TENANT.PROMOTIONS_CANCEL,
    APPLICATION_SETTINGS_AMOUNT_LIMITS_READ:
      PLATFORM.CUSTOMER_LOAN_APP_SETTINGS_AMOUNT_LIMITS_READ,
    APPLICATION_SETTINGS_READ: TENANT.LOAN_APP_SETTINGS_READ,
    APPLICATION_SETTINGS_UPDATE: TENANT.LOAN_APP_SETTINGS_UPDATE,
  },
  SUPPORT: {
    CUSTOMER_VIEW: PLATFORM.CUSTOMER_SUPPORT_TICKETS_VIEW,
    CUSTOMER_CREATE: PLATFORM.CUSTOMER_SUPPORT_TICKETS_CREATE,
    CUSTOMER_READ: PLATFORM.CUSTOMER_SUPPORT_TICKETS_READ,
    CUSTOMER_REPLY: PLATFORM.CUSTOMER_SUPPORT_TICKETS_REPLY,
    TENANT_VIEW: TENANT.SUPPORT_TICKETS_VIEW,
    TENANT_READ: TENANT.SUPPORT_TICKETS_READ,
    TENANT_REPLY: TENANT.SUPPORT_TICKETS_REPLY,
    TENANT_UPDATE_STATUS: TENANT.SUPPORT_TICKETS_UPDATE_STATUS,
    TENANT_UPDATE_PRIORITY: TENANT.SUPPORT_TICKETS_UPDATE_PRIORITY,
    TENANT_ASSIGN: TENANT.SUPPORT_TICKETS_ASSIGN,
    PLATFORM_VIEW: PLATFORM.SUPPORT_TICKETS_VIEW,
    PLATFORM_READ: PLATFORM.SUPPORT_TICKETS_READ,
    PLATFORM_REPLY: PLATFORM.SUPPORT_TICKETS_REPLY,
    PLATFORM_UPDATE_STATUS: PLATFORM.SUPPORT_TICKETS_UPDATE_STATUS,
    PLATFORM_UPDATE_PRIORITY: PLATFORM.SUPPORT_TICKETS_UPDATE_PRIORITY,
    PLATFORM_ASSIGN: PLATFORM.SUPPORT_TICKETS_ASSIGN,
    CATEGORIES_VIEW: PLATFORM.SUPPORT_CATEGORIES_VIEW,
    CATEGORIES_READ: PLATFORM.SUPPORT_CATEGORIES_READ,
    CATEGORIES_CREATE: PLATFORM.SUPPORT_CATEGORIES_CREATE,
    CATEGORIES_UPDATE: PLATFORM.SUPPORT_CATEGORIES_UPDATE,
    CATEGORIES_DELETE: PLATFORM.SUPPORT_CATEGORIES_DELETE,
  },
  SPECIAL_OFFERS: {
    VIEW: PLATFORM.CUSTOMER_SPECIAL_OFFERS_VIEW,
    SELF_READ: PLATFORM.CUSTOMER_SPECIAL_OFFERS_SELF_READ,
    SELF_REDEEM: PLATFORM.CUSTOMER_SPECIAL_OFFERS_SELF_REDEEM,
    SELF_DISMISS: PLATFORM.CUSTOMER_SPECIAL_OFFERS_SELF_DISMISS,
    TENANT_VIEW: TENANT.SPECIAL_OFFER_VIEW,
    CREATE: TENANT.SPECIAL_OFFER_CREATE,
    READ: TENANT.SPECIAL_OFFER_READ,
    UPDATE: TENANT.SPECIAL_OFFER_UPDATE,
    DELETE: TENANT.SPECIAL_OFFER_DELETE,
  },
  SUBSCRIPTIONS: {
    VIEW: TENANT.SUBSCRIPTION_VIEW,
    PLANS_VIEW: TENANT.SUBSCRIPTION_PLANS_VIEW,
    PLANS_READ: TENANT.SUBSCRIPTION_PLANS_READ,
    PAY: TENANT.SUBSCRIPTION_PAY,
    PAYMENTS_VIEW: TENANT.SUBSCRIPTION_PAYMENTS_VIEW,
    ACCESS_VIEW: TENANT.SUBSCRIPTION_ACCESS_VIEW,
    HISTORY_VIEW: TENANT.SUBSCRIPTION_HISTORY_VIEW,
  },
  PLATFORM_SUBSCRIPTION_PLANS: {
    VIEW: PLATFORM.SUBSCRIPTION_PLANS_VIEW,
    READ: PLATFORM.SUBSCRIPTION_PLANS_READ,
    STATS_VIEW: PLATFORM.SUBSCRIPTION_PLANS_STATS_VIEW,
    SUBSCRIBERS_VIEW: PLATFORM.SUBSCRIPTION_PLANS_SUBSCRIBERS_VIEW,
    CREATE: PLATFORM.SUBSCRIPTION_PLANS_CREATE,
    UPDATE: PLATFORM.SUBSCRIPTION_PLANS_UPDATE,
    STATUS_UPDATE: PLATFORM.SUBSCRIPTION_PLANS_STATUS_UPDATE,
    DELETE: PLATFORM.SUBSCRIPTION_PLANS_DELETE,
  },
  PLATFORM_SUBSCRIPTIONS: {
    VIEW: PLATFORM.SUBSCRIPTIONS_VIEW,
    RECORD: PLATFORM.SUBSCRIPTIONS_RECORD,
  },
  PLATFORM_PAYMENT_TRANSACTIONS: {
    VIEW: PLATFORM.PAYMENT_TRANSACTIONS_VIEW,
    READ: PLATFORM.PAYMENT_TRANSACTIONS_READ,
    STATS_VIEW: PLATFORM.PAYMENT_TRANSACTIONS_STATS_VIEW,
  },
  CONTENT_MANAGEMENT: {
    VIEW: TENANT.CONTENT_MANAGEMENT_VIEW,
    ADVERTS_READ: TENANT.ADVERTS_READ,
    ADVERTS_CREATE: TENANT.ADVERTS_CREATE,
    ADVERTS_UPDATE: TENANT.ADVERTS_UPDATE,
    ADVERTS_DELETE: TENANT.ADVERTS_DELETE,
    ANNOUNCEMENTS_READ: TENANT.ANNOUNCEMENTS_READ,
    ANNOUNCEMENTS_CREATE: TENANT.ANNOUNCEMENTS_CREATE,
    ANNOUNCEMENTS_UPDATE: TENANT.ANNOUNCEMENTS_UPDATE,
    ANNOUNCEMENTS_DELETE: TENANT.ANNOUNCEMENTS_DELETE,
    BRAND_SHOWCASES_READ: TENANT.BRAND_SHOWCASES_READ,
    BRAND_SHOWCASES_CREATE: TENANT.BRAND_SHOWCASES_CREATE,
    BRAND_SHOWCASES_UPDATE: TENANT.BRAND_SHOWCASES_UPDATE,
    BRAND_SHOWCASES_DELETE: TENANT.BRAND_SHOWCASES_DELETE,
  },
} as const;

type NestedValueOf<T> = T extends Record<string, infer Value> ? Value : never;

export type PermissionType = NestedValueOf<NestedValueOf<typeof PERMISSIONS>>;

export const ALL_PERMISSIONS_ARRAY: string[] = Array.from(
  new Set(
    Object.values(PERMISSIONS).flatMap((entityObj) => Object.values(entityObj)),
  ),
);
