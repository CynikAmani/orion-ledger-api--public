export const MFA_TOKEN_PURPOSE = 'mfa_verification' as const;
export const MFA_TOKEN_TTL = '5m' as const;
export const MFA_PIN_TTL_MS = 5 * 60 * 1000;
export const MFA_MAX_VERIFY_ATTEMPTS = 3;
export const MFA_MAX_RESEND_COUNT = 2;
export const MFA_RESEND_COOLDOWN_MS = 60 * 1000;
