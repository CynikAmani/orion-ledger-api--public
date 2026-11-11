export const SUPER_ADMIN_ROLE_KEY = 'SUPER_ADMIN' as const;
export const CUSTOMER_ROLE_KEY = 'CUSTOMER' as const;

/** Immutable bootstrap account userId (login username) for the infrastructure Super Admin */
export const SYSTEM_ROOT_USER_ID = 'sudo@orionloans-hub.africa' as const;

/** Login email for the bootstrap Super Admin — keep aligned with SYSTEM_ROOT_USER_ID */
export const SYSTEM_ROOT_USER_EMAIL = SYSTEM_ROOT_USER_ID;

export const SYSTEM_ROLES = {
  SUPER_ADMIN: {
    key: SUPER_ADMIN_ROLE_KEY,
    name: 'Super Admin',
    description:
      'Root system administrator with global infrastructure capabilities.',
  },
  CUSTOMER: {
    key: CUSTOMER_ROLE_KEY,
    name: 'Customer',
    description: 'Default customer account role for registered users.',
  },
} as const;
